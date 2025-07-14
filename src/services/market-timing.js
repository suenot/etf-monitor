// Сервис для определения оптимального времени торговли
import { tinkoffApi } from './tinkoff-api.js';
import { BALANCER_CONFIG } from '../config/balancer-config.js';

class MarketTimingService {
    constructor() {
        this.volatilityHistory = new Map(); // ticker -> [volatility data]
        this.lastAnalysis = null;
    }

    // Получение исторических данных для анализа волатильности
    async getHistoricalData(figi, days = 7) {
        try {
            const api = await tinkoffApi.connect();
            const to = new Date();
            const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
            
            const response = await api.marketData.getCandles({
                figi,
                from,
                to,
                interval: 'CANDLE_INTERVAL_HOUR' // Часовые свечи
            });
            
            return response.candles || [];
        } catch (error) {
            console.error(`Ошибка получения исторических данных для ${figi}:`, error);
            return [];
        }
    }

    // Конвертация Tinkoff Number в обычное число
    convertTinkoffNumberToNumber(tinkoffNumber) {
        if (!tinkoffNumber) return 0;
        return tinkoffNumber.units + (tinkoffNumber.nano / 1000000000);
    }

    // Расчет волатильности для часа
    calculateHourlyVolatility(candles) {
        const hourlyVolatility = new Array(24).fill(0);
        const hourlyCounts = new Array(24).fill(0);
        
        for (const candle of candles) {
            const hour = new Date(candle.time).getUTCHours();
            const high = this.convertTinkoffNumberToNumber(candle.high);
            const low = this.convertTinkoffNumberToNumber(candle.low);
            const open = this.convertTinkoffNumberToNumber(candle.open);
            
            if (open > 0) {
                const volatility = (high - low) / open;
                hourlyVolatility[hour] += volatility;
                hourlyCounts[hour]++;
            }
        }
        
        // Вычисляем среднюю волатильность для каждого часа
        for (let i = 0; i < 24; i++) {
            if (hourlyCounts[i] > 0) {
                hourlyVolatility[i] = hourlyVolatility[i] / hourlyCounts[i];
            }
        }
        
        return hourlyVolatility;
    }

    // Анализ волатильности рынка
    async analyzeMarketVolatility(tickers) {
        try {
            console.log('Анализ волатильности рынка...');
            
            const allVolatilities = [];
            
            for (const ticker of tickers) {
                try {
                    // Получаем FIGI для тикера
                    const etfs = await tinkoffApi.getEtfs();
                    const etf = etfs.find(e => e.ticker === ticker);
                    
                    if (!etf) {
                        console.warn(`ETF с тикером ${ticker} не найден`);
                        continue;
                    }
                    
                    // Получаем исторические данные
                    const candles = await this.getHistoricalData(
                        etf.figi, 
                        BALANCER_CONFIG.QUIET_HOURS.MOVING_AVERAGE_DAYS
                    );
                    
                    if (candles.length === 0) {
                        console.warn(`Нет исторических данных для ${ticker}`);
                        continue;
                    }
                    
                    // Рассчитываем почасовую волатильность
                    const hourlyVolatility = this.calculateHourlyVolatility(candles);
                    
                    this.volatilityHistory.set(ticker, hourlyVolatility);
                    allVolatilities.push(hourlyVolatility);
                    
                    // Небольшая задержка между запросами
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                } catch (error) {
                    console.error(`Ошибка анализа волатильности для ${ticker}:`, error);
                }
            }
            
            if (allVolatilities.length === 0) {
                throw new Error('Не удалось получить данные о волатильности');
            }
            
            // Вычисляем среднюю волатильность по всем инструментам для каждого часа
            const avgHourlyVolatility = new Array(24).fill(0);
            
            for (let hour = 0; hour < 24; hour++) {
                let sum = 0;
                let count = 0;
                
                for (const volatilities of allVolatilities) {
                    if (volatilities[hour] > 0) {
                        sum += volatilities[hour];
                        count++;
                    }
                }
                
                if (count > 0) {
                    avgHourlyVolatility[hour] = sum / count;
                }
            }
            
            this.lastAnalysis = {
                avgHourlyVolatility,
                analyzedAt: new Date(),
                tickersAnalyzed: tickers.length
            };
            
            console.log('Анализ волатильности завершен:', this.lastAnalysis);
            
            return this.lastAnalysis;
            
        } catch (error) {
            console.error('Ошибка анализа волатильности рынка:', error);
            throw error;
        }
    }

    // Определение самого спокойного времени для торговли
    async findQuietestTradingTime(tickers) {
        try {
            // Обновляем анализ если нужно
            if (!this.lastAnalysis || 
                Date.now() - this.lastAnalysis.analyzedAt.getTime() > 60 * 60 * 1000) { // 1 час
                await this.analyzeMarketVolatility(tickers);
            }
            
            const { avgHourlyVolatility } = this.lastAnalysis;
            const { ANALYSIS_HOURS, VOLATILITY_THRESHOLD } = BALANCER_CONFIG.QUIET_HOURS;
            
            // Находим часы с минимальной волатильностью в рамках торговых часов
            let quietestHour = null;
            let minVolatility = Infinity;
            
            for (const hour of ANALYSIS_HOURS) {
                const volatility = avgHourlyVolatility[hour];
                
                if (volatility > 0 && volatility < minVolatility) {
                    minVolatility = volatility;
                    quietestHour = hour;
                }
            }
            
            const isQuietTime = minVolatility < VOLATILITY_THRESHOLD;
            
            const result = {
                quietestHour,
                minVolatility,
                isQuietTime,
                currentHour: new Date().getUTCHours(),
                recommendation: this.getTimeRecommendation(quietestHour, minVolatility, isQuietTime)
            };
            
            console.log('Анализ времени торговли:', result);
            
            return result;
            
        } catch (error) {
            console.error('Ошибка определения времени торговли:', error);
            throw error;
        }
    }

    // Получение рекомендации по времени торговли
    getTimeRecommendation(quietestHour, minVolatility, isQuietTime) {
        const currentHour = new Date().getUTCHours();
        
        if (!quietestHour) {
            return {
                action: 'wait',
                reason: 'Недостаточно данных для анализа',
                nextCheckIn: 60 // минут
            };
        }
        
        if (currentHour === quietestHour && isQuietTime) {
            return {
                action: 'trade',
                reason: `Текущее время (${currentHour}:00 UTC) является самым спокойным с волатильностью ${minVolatility.toFixed(4)}`,
                confidence: 'high'
            };
        }
        
        if (Math.abs(currentHour - quietestHour) <= 1 && isQuietTime) {
            return {
                action: 'trade',
                reason: `Близко к самому спокойному времени (${quietestHour}:00 UTC)`,
                confidence: 'medium'
            };
        }
        
        const hoursUntilQuiet = quietestHour > currentHour 
            ? quietestHour - currentHour 
            : (24 - currentHour) + quietestHour;
        
        return {
            action: 'wait',
            reason: `Ожидание более спокойного времени (${quietestHour}:00 UTC)`,
            nextCheckIn: Math.min(hoursUntilQuiet * 60, 60), // максимум 1 час
            hoursUntilQuiet
        };
    }

    // Проверка, подходит ли текущее время для торговли
    async isGoodTimeToTrade(tickers) {
        try {
            const timing = await this.findQuietestTradingTime(tickers);
            return timing.recommendation.action === 'trade';
        } catch (error) {
            console.error('Ошибка проверки времени торговли:', error);
            // В случае ошибки разрешаем торговлю (консервативный подход)
            return true;
        }
    }

    // Получение статистики волатильности
    getVolatilityStats() {
        if (!this.lastAnalysis) {
            return null;
        }
        
        const { avgHourlyVolatility } = this.lastAnalysis;
        const stats = {
            minVolatility: Math.min(...avgHourlyVolatility.filter(v => v > 0)),
            maxVolatility: Math.max(...avgHourlyVolatility),
            avgVolatility: avgHourlyVolatility.reduce((sum, v) => sum + v, 0) / avgHourlyVolatility.filter(v => v > 0).length,
            hourlyData: avgHourlyVolatility.map((vol, hour) => ({ hour, volatility: vol }))
        };
        
        return stats;
    }
}

// Экспортируем singleton экземпляр
export const marketTiming = new MarketTimingService();
export default marketTiming;
