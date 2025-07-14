// Основной сервис балансировщика портфеля
import { tinkoffApi } from './tinkoff-api.js';
import { portfolioCalculator } from './portfolio-calculator.js';
import { marketTiming } from './market-timing.js';
import { BALANCER_CONFIG, validateConfig } from '../config/balancer-config.js';

class BalancerService {
    constructor() {
        this.isRunning = false;
        this.lastBalance = null;
        this.balanceHistory = [];
        this.accountId = null;
    }

    // Инициализация сервиса
    async initialize() {
        try {
            console.log('Инициализация балансировщика...');
            
            // Валидация конфигурации
            validateConfig();
            
            // Получение ID аккаунта
            this.accountId = await this.getAccountId();
            console.log(`Используется аккаунт: ${this.accountId}`);
            
            console.log('Балансировщик инициализирован успешно');
            return true;
            
        } catch (error) {
            console.error('Ошибка инициализации балансировщика:', error);
            throw error;
        }
    }

    // Получение ID аккаунта
    async getAccountId() {
        try {
            const api = await tinkoffApi.connect();
            
            if (BALANCER_CONFIG.ACCOUNT_ID !== 'ISS' && BALANCER_CONFIG.ACCOUNT_ID !== 'BROKER') {
                return BALANCER_CONFIG.ACCOUNT_ID;
            }
            
            const accountsResult = await api.users.getAccounts({});
            
            const account = BALANCER_CONFIG.ACCOUNT_ID === 'ISS' 
                ? accountsResult.accounts.find(acc => acc.type === 2) // ИИС
                : accountsResult.accounts.find(acc => acc.type === 1); // Брокерский
            
            if (!account) {
                throw new Error(`Аккаунт типа ${BALANCER_CONFIG.ACCOUNT_ID} не найден`);
            }
            
            return account.id;
            
        } catch (error) {
            console.error('Ошибка получения ID аккаунта:', error);
            throw error;
        }
    }

    // Конвертация Tinkoff Number в обычное число
    convertTinkoffNumberToNumber(tinkoffNumber) {
        if (!tinkoffNumber) return 0;
        return tinkoffNumber.units + (tinkoffNumber.nano / 1000000000);
    }

    // Получение информации об инструменте
    async getInstrumentInfo(figi) {
        try {
            const api = await tinkoffApi.connect();
            const response = await api.instruments.getInstrumentBy({
                idType: 'INSTRUMENT_ID_TYPE_FIGI',
                id: figi
            });
            
            return response.instrument;
        } catch (error) {
            console.error(`Ошибка получения информации об инструменте ${figi}:`, error);
            return null;
        }
    }

    // Получение текущего портфеля
    async getCurrentPortfolio() {
        try {
            const api = await tinkoffApi.connect();
            
            // Получаем позиции
            const positionsResponse = await api.operations.getPositions({
                accountId: this.accountId
            });
            
            // Получаем портфель
            const portfolioResponse = await api.operations.getPortfolio({
                accountId: this.accountId
            });
            
            const portfolio = {
                positions: [],
                totalValue: 0,
                currency: 'RUB'
            };
            
            // Обрабатываем денежные позиции
            for (const money of positionsResponse.money) {
                if (money.currency === 'rub') {
                    portfolio.positions.push({
                        ticker: 'RUB',
                        figi: null,
                        quantity: this.convertTinkoffNumberToNumber(money),
                        price: 1,
                        value: this.convertTinkoffNumberToNumber(money),
                        percentage: 0 // Рассчитаем позже
                    });
                    portfolio.totalValue += this.convertTinkoffNumberToNumber(money);
                }
            }
            
            // Обрабатываем позиции ценных бумаг
            for (const position of portfolioResponse.positions) {
                try {
                    // Получаем информацию об инструменте
                    const instrument = await this.getInstrumentInfo(position.figi);
                    
                    if (!instrument) continue;
                    
                    const quantity = this.convertTinkoffNumberToNumber(position.quantity);
                    const price = this.convertTinkoffNumberToNumber(position.currentPrice);
                    const value = quantity * price;
                    
                    portfolio.positions.push({
                        ticker: instrument.ticker,
                        figi: position.figi,
                        quantity,
                        price,
                        value,
                        percentage: 0 // Рассчитаем позже
                    });
                    
                    portfolio.totalValue += value;
                    
                } catch (error) {
                    console.warn(`Ошибка обработки позиции ${position.figi}:`, error.message);
                }
            }
            
            // Рассчитываем проценты
            for (const position of portfolio.positions) {
                position.percentage = portfolio.totalValue > 0 
                    ? (position.value / portfolio.totalValue) * 100 
                    : 0;
            }
            
            console.log(`Текущий портфель: ${portfolio.totalValue.toFixed(2)} RUB, ${portfolio.positions.length} позиций`);
            
            return portfolio;
            
        } catch (error) {
            console.error('Ошибка получения текущего портфеля:', error);
            throw error;
        }
    }

    // Расчет необходимых операций для балансировки
    calculateRebalanceOperations(currentPortfolio, desiredPortfolio) {
        const operations = [];
        const totalValue = currentPortfolio.totalValue;
        
        if (totalValue < BALANCER_CONFIG.MIN_ORDER_VALUE) {
            console.warn(`Общая стоимость портфеля (${totalValue}) меньше минимальной суммы для торговли`);
            return operations;
        }
        
        // Создаем карту текущих позиций
        const currentPositions = new Map();
        for (const position of currentPortfolio.positions) {
            currentPositions.set(position.ticker, position);
        }
        
        // Анализируем каждую позицию из желаемого портфеля
        for (const [ticker, desiredPercent] of Object.entries(desiredPortfolio.portfolio)) {
            const currentPosition = currentPositions.get(ticker);
            const currentPercent = currentPosition ? currentPosition.percentage : 0;
            
            const percentDiff = desiredPercent - currentPercent;
            
            // Проверяем, нужна ли корректировка
            if (Math.abs(percentDiff) > BALANCER_CONFIG.MAX_DEVIATION_PERCENT) {
                const targetValue = (desiredPercent / 100) * totalValue;
                const currentValue = currentPosition ? currentPosition.value : 0;
                const valueDiff = targetValue - currentValue;
                
                if (Math.abs(valueDiff) > BALANCER_CONFIG.MIN_ORDER_VALUE) {
                    operations.push({
                        ticker,
                        figi: currentPosition?.figi,
                        action: valueDiff > 0 ? 'BUY' : 'SELL',
                        currentPercent: currentPercent.toFixed(2),
                        desiredPercent: desiredPercent.toFixed(2),
                        percentDiff: percentDiff.toFixed(2),
                        currentValue: currentValue.toFixed(2),
                        targetValue: targetValue.toFixed(2),
                        valueDiff: Math.abs(valueDiff).toFixed(2),
                        priority: Math.abs(percentDiff) // Приоритет по размеру отклонения
                    });
                }
            }
        }
        
        // Сортируем операции по приоритету (большие отклонения первыми)
        operations.sort((a, b) => b.priority - a.priority);
        
        return operations;
    }

    // Выполнение одной операции балансировки
    async executeOperation(operation) {
        try {
            if (BALANCER_CONFIG.SAFETY.DRY_RUN) {
                console.log(`[DRY RUN] Операция: ${operation.action} ${operation.ticker} на сумму ${operation.valueDiff} RUB`);
                return { success: true, dryRun: true };
            }

            // Здесь будет реальная логика выполнения ордеров
            // Пока что заглушка
            console.log(`Выполнение операции: ${operation.action} ${operation.ticker} на сумму ${operation.valueDiff} RUB`);

            // TODO: Реализовать реальные торговые операции

            return { success: true, operation };

        } catch (error) {
            console.error(`Ошибка выполнения операции ${operation.action} ${operation.ticker}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Основная функция балансировки
    async rebalance() {
        try {
            if (this.isRunning) {
                console.log('Балансировка уже выполняется, пропускаем...');
                return { success: false, reason: 'already_running' };
            }

            this.isRunning = true;
            console.log('=== Начало балансировки портфеля ===');

            // 1. Проверяем время торговли
            const isGoodTime = await marketTiming.isGoodTimeToTrade(BALANCER_CONFIG.TINKOFF_ETFS);
            if (!isGoodTime) {
                console.log('Неподходящее время для торговли, откладываем балансировку');
                return { success: false, reason: 'bad_timing' };
            }

            // 2. Получаем текущий портфель
            const currentPortfolio = await this.getCurrentPortfolio();

            // 3. Рассчитываем желаемый портфель
            const desiredPortfolio = await portfolioCalculator.calculateDesiredPortfolio();

            // 4. Рассчитываем необходимые операции
            const operations = this.calculateRebalanceOperations(currentPortfolio, desiredPortfolio);

            if (operations.length === 0) {
                console.log('Портфель уже сбалансирован, операции не требуются');
                return {
                    success: true,
                    reason: 'already_balanced',
                    currentPortfolio,
                    desiredPortfolio
                };
            }

            console.log(`Требуется выполнить ${operations.length} операций:`);
            operations.forEach(op => {
                console.log(`  ${op.action} ${op.ticker}: ${op.currentPercent}% -> ${op.desiredPercent}% (${op.valueDiff} RUB)`);
            });

            // 5. Выполняем операции
            const results = [];
            for (const operation of operations) {
                const result = await this.executeOperation(operation);
                results.push(result);

                if (result.success) {
                    console.log(`✓ Операция ${operation.action} ${operation.ticker} выполнена успешно`);
                } else {
                    console.error(`✗ Ошибка операции ${operation.action} ${operation.ticker}: ${result.error}`);
                }

                // Задержка между операциями
                await new Promise(resolve => setTimeout(resolve, BALANCER_CONFIG.SLEEP_BETWEEN_ORDERS));
            }

            // 6. Сохраняем результат
            const balanceResult = {
                timestamp: new Date(),
                currentPortfolio,
                desiredPortfolio,
                operations,
                results,
                success: results.every(r => r.success),
                totalOperations: operations.length,
                successfulOperations: results.filter(r => r.success).length
            };

            this.lastBalance = balanceResult;
            this.balanceHistory.push(balanceResult);

            // Ограничиваем историю последними 100 записями
            if (this.balanceHistory.length > 100) {
                this.balanceHistory = this.balanceHistory.slice(-100);
            }

            console.log('=== Балансировка завершена ===');
            console.log(`Успешно: ${balanceResult.successfulOperations}/${balanceResult.totalOperations} операций`);

            return balanceResult;

        } catch (error) {
            console.error('Ошибка балансировки портфеля:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
        } finally {
            this.isRunning = false;
        }
    }

    // Запуск автоматической балансировки
    async startAutoRebalancing() {
        try {
            console.log('Запуск автоматической балансировки...');
            console.log(`Интервал: ${BALANCER_CONFIG.BALANCE_INTERVAL / 1000} секунд`);

            // Первая балансировка
            await this.rebalance();

            // Настройка периодической балансировки
            setInterval(async () => {
                try {
                    await this.rebalance();
                } catch (error) {
                    console.error('Ошибка в автоматической балансировке:', error);
                }
            }, BALANCER_CONFIG.BALANCE_INTERVAL);

            console.log('Автоматическая балансировка запущена');

        } catch (error) {
            console.error('Ошибка запуска автоматической балансировки:', error);
            throw error;
        }
    }

    // Получение статистики балансировщика
    getStats() {
        return {
            isRunning: this.isRunning,
            lastBalance: this.lastBalance,
            totalBalances: this.balanceHistory.length,
            successRate: this.balanceHistory.length > 0
                ? (this.balanceHistory.filter(b => b.success).length / this.balanceHistory.length) * 100
                : 0,
            accountId: this.accountId,
            config: {
                interval: BALANCER_CONFIG.BALANCE_INTERVAL,
                etfsCount: BALANCER_CONFIG.TINKOFF_ETFS.length,
                dryRun: BALANCER_CONFIG.SAFETY.DRY_RUN
            }
        };
    }

    // Остановка балансировщика
    stop() {
        this.isRunning = false;
        console.log('Балансировщик остановлен');
    }
}

// Экспортируем singleton экземпляр
export const balancer = new BalancerService();
export default balancer;
