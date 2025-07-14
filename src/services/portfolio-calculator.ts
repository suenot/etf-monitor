import type { ApiResponse, FullEtfInfo, QueryResult } from '../types/index.js';
// Сервис для расчета пропорций портфеля на основе market cap фондов
import { tinkoffApi } from './tinkoff-api.js';
import { BALANCER_CONFIG } from '../config/balancer-config.js';

class PortfolioCalculatorService {
    private etfData: Map<string, any> = new Map();
    private lastUpdate: number | null = null;
    private updateInterval: number = 5 * 60 * 1000;
    constructor() {
        this.etfData = new Map();
        this.lastUpdate = null;
        this.updateInterval = 5 * 60 * 1000; // 5 минут
    }

    // Получение данных о всех фондах Тинькофф
    async getTinkoffEtfsData() {
        try {
            console.log('Получение данных о фондах Тинькофф...');
            
            // Получаем все ETF
            const allEtfs = await tinkoffApi.getEtfs();
            
            // Фильтруем только фонды Тинькофф из конфигурации
            const tinkoffEtfs = allEtfs.filter(etf => 
                (BALANCER_CONFIG.TINKOFF_ETFS[0] as string).includes(etf.ticker)
            );
            
            console.log(`Найдено ${tinkoffEtfs.length} фондов Тинькофф из ${(BALANCER_CONFIG.TINKOFF_ETFS[0] as string).length} в конфигурации`);
            
            // Получаем детальную информацию для каждого фонда
            const etfsWithDetails = [];
            
            for (const etf of tinkoffEtfs) {
                try {
                    const fullInfo = await tinkoffApi.getFullEtfInfo(etf);
                    
                    // Получаем последнюю цену
                    const lastPrice = await this.getLastPrice(etf.figi);
                    
                    etfsWithDetails.push({
                        ...fullInfo,
                        lastPrice
                    });
                    
                    // Небольшая задержка между запросами
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error: any) {
                    console.warn(`Ошибка получения данных для ${etf.ticker}:`, error.message);
                }
            }
            
            return etfsWithDetails;
            
        } catch (error: any) {
            console.error('Ошибка при получении данных о фондах:', error);
            throw error;
        }
    }

    // Получение последней цены инструмента
    async getLastPrice(figi: string) {
        try {
            const api = await tinkoffApi.connect();
            const response = await api.marketdata.getLastPrices({
                figi: [figi]
            });
            
            if (response.lastPrices && response.lastPrices.length > 0) {
                const price = response.lastPrices[0].price;
                return this.convertTinkoffNumberToNumber(price);
            }
            
            return null;
        } catch (error: any) {
            console.error(`Ошибка получения цены для ${figi}:`, error);
            return null;
        }
    }

    // Конвертация Tinkoff Number в обычное число
    convertTinkoffNumberToNumber(tinkoffNumber) {
        if (!tinkoffNumber) return 0;
        return tinkoffNumber.units + (tinkoffNumber.nano / 1000000000);
    }

    // Расчет market cap для фонда
    calculateMarketCap(etfData: any) {
        try {
            const { basic, detailed, asset, lastPrice } = etfData;
            
            if (!lastPrice) {
                console.warn(`Нет цены для ${basic.ticker}`);
                return 0;
            }
            
            // Пытаемся получить количество акций в обращении из разных источников
            let sharesOutstanding = 0;
            
            // 1. Из asset.etf.num_share (если есть)
            if (asset && asset.etf && asset.etf.numShare) {
                sharesOutstanding = this.convertTinkoffNumberToNumber(asset.etf.numShare);
            }
            
            // 2. Если нет данных об акциях, используем приблизительную оценку
            // на основе размера фонда (если доступно)
            if (sharesOutstanding === 0) {
                // Используем лотность как приблизительную оценку
                // Это не точно, но лучше чем ничего
                sharesOutstanding = basic.lot * 1000000; // Примерная оценка
                console.warn(`Используется приблизительная оценка акций для ${basic.ticker}: ${sharesOutstanding}`);
            }
            
            const marketCap = sharesOutstanding * lastPrice;
            
            console.log(`${basic.ticker}: цена=${lastPrice}, акций=${sharesOutstanding}, market cap=${marketCap}`);
            
            return marketCap;
            
        } catch (error: any) {
            console.error(`Ошибка расчета market cap для ${etfData.basic?.ticker}:`, error);
            return 0;
        }
    }

    // Расчет желаемых пропорций портфеля на основе market cap
    async calculateDesiredPortfolio() {
        try {
            // Обновляем данные если нужно
            if (!this.lastUpdate || Date.now() - (this.lastUpdate as number) > (this.updateInterval as number)) {
                console.log('Обновление данных о фондах...');
                const etfsData = await this.getTinkoffEtfsData();
                
                // Сохраняем данные
                this.etfData.clear();
                for (const etfData of etfsData) {
                    this.etfData.set(etfData.basic.ticker, etfData);
                }
                
                this.lastUpdate = Date.now();
            }
            
            // Рассчитываем market cap для каждого фонда
            const marketCaps = new Map();
            let totalMarketCap = 0;
            
            for (const [ticker, etfData] of this.etfData) {
                const marketCap = this.calculateMarketCap(etfData);
                marketCaps.set(ticker, marketCap);
                totalMarketCap += marketCap;
            }
            
            if (totalMarketCap === 0) {
                throw new Error('Общий market cap равен нулю');
            }
            
            // Рассчитываем пропорции
            const desiredPortfolio = {};
            
            for (const [ticker, marketCap] of marketCaps) {
                const proportion = (marketCap / totalMarketCap) * 100;
                desiredPortfolio[ticker] = Math.round(proportion * 100) / 100; // Округляем до 2 знаков
            }
            
            // Добавляем рубли (небольшой процент для ликвидности)
            desiredPortfolio['RUB'] = 5; // 5% в рублях для ликвидности
            
            // Нормализуем чтобы сумма была 100%
            const totalPercent = Object.values(desiredPortfolio).reduce((sum: number, percent: number) => sum + percent, 0);
            for (const ticker in desiredPortfolio) {
                desiredPortfolio[ticker] = Math.round((desiredPortfolio[ticker] / (totalPercent as number) * 100) * 100) / 100;
            }
            
            console.log('Рассчитанный желаемый портфель:', desiredPortfolio);
            
            return {
                portfolio: desiredPortfolio,
                marketCaps,
                totalMarketCap,
                calculatedAt: new Date()
            };
            
        } catch (error: any) {
            console.error('Ошибка расчета желаемого портфеля:', error);
            throw error;
        }
    }

    // Получение информации о конкретном фонде
    getEtfInfo(ticker: string) {
        return this.etfData.get(ticker);
    }

    // Получение всех доступных фондов
    getAvailableEtfs() {
        return Array.from(this.etfData.keys());
    }
}

// Экспортируем singleton экземпляр
export const portfolioCalculator = new PortfolioCalculatorService();
export default portfolioCalculator;
