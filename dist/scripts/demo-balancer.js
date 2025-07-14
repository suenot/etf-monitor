// Демонстрация работы балансировщика с моковыми данными
import { BALANCER_CONFIG } from '../config/balancer-config.js';
// Моковые данные о фондах Тинькофф
const MOCK_ETF_DATA = {
    'TMOS': {
        name: 'Тинькофф iMOEX',
        price: 1850.5,
        numShares: 50000000,
        marketCap: 92525000000 // 92.5 млрд
    },
    'TRUR': {
        name: 'Тинькофф Вечный портфель',
        price: 1420.3,
        numShares: 35000000,
        marketCap: 49710500000 // 49.7 млрд
    },
    'TBRU': {
        name: 'Тинькофф Bonds',
        price: 980.7,
        numShares: 25000000,
        marketCap: 24517500000 // 24.5 млрд
    },
    'TSPV': {
        name: 'Тинькофф S&P 500',
        price: 2150.8,
        numShares: 15000000,
        marketCap: 32262000000 // 32.3 млрд
    },
    'TEUS': {
        name: 'Тинькофф Европа',
        price: 1680.2,
        numShares: 8000000,
        marketCap: 13441600000 // 13.4 млрд
    },
    'TEMS': {
        name: 'Тинькофф Emerging Markets',
        price: 1320.5,
        numShares: 6000000,
        marketCap: 7923000000 // 7.9 млрд
    },
    'TGLD': {
        name: 'Тинькофф Золото',
        price: 2850.1,
        numShares: 3000000,
        marketCap: 8550300000 // 8.6 млрд
    }
};
// Моковый текущий портфель
const MOCK_CURRENT_PORTFOLIO = {
    totalValue: 1000000, // 1 млн рублей
    positions: [
        { ticker: 'TMOS', value: 400000, percentage: 40.0 },
        { ticker: 'TRUR', value: 300000, percentage: 30.0 },
        { ticker: 'TBRU', value: 150000, percentage: 15.0 },
        { ticker: 'TSPV', value: 100000, percentage: 10.0 },
        { ticker: 'RUB', value: 50000, percentage: 5.0 }
    ]
};
// Моковые данные волатильности по часам (UTC)
const MOCK_VOLATILITY_DATA = [
    0.015, 0.012, 0.008, 0.006, 0.005, 0.007, 0.010, 0.018, // 0-7
    0.025, 0.035, 0.028, 0.022, 0.018, 0.015, 0.012, 0.010, // 8-15
    0.008, 0.006, 0.009, 0.012, 0.015, 0.018, 0.020, 0.017 // 16-23
];
class DemoBalancer {
    etfData = {};
    currentPortfolio = {};
    volatilityData = {};
    constructor() {
        this.etfData = MOCK_ETF_DATA;
        this.currentPortfolio = MOCK_CURRENT_PORTFOLIO;
        this.volatilityData = MOCK_VOLATILITY_DATA;
    }
    // Расчет желаемого портфеля на основе market cap
    calculateDesiredPortfolio() {
        console.log('📊 Расчет желаемого портфеля на основе market cap...\n');
        // Рассчитываем общий market cap
        let totalMarketCap = 0;
        for (const [ticker, data] of Object.entries(this.etfData)) {
            totalMarketCap += data.marketCap;
            console.log(`${ticker} (${data.name}): ${(data.marketCap / 1000000000).toFixed(1)} млрд RUB`);
        }
        console.log(`\nОбщий market cap: ${(totalMarketCap / 1000000000).toFixed(1)} млрд RUB\n`);
        // Рассчитываем пропорции
        const desiredPortfolio = {};
        console.log('Желаемые пропорции портфеля:');
        for (const [ticker, data] of Object.entries(this.etfData)) {
            const proportion = (data.marketCap / totalMarketCap) * 95; // 95% в фонды, 5% в рубли
            desiredPortfolio[ticker] = proportion;
            console.log(`${ticker}: ${proportion.toFixed(2)}%`);
        }
        desiredPortfolio['RUB'] = 5.0; // 5% в рублях для ликвидности
        console.log(`RUB: 5.00% (для ликвидности)\n`);
        return { portfolio: desiredPortfolio, totalMarketCap };
    }
    // Анализ времени торговли
    analyzeMarketTiming() {
        console.log('⏰ Анализ оптимального времени торговли...\n');
        const currentHour = new Date().getUTCHours();
        let quietestHour = 0;
        let minVolatility = Math.min(...this.volatilityData);
        for (let hour = 0; hour < 24; hour++) {
            if (this.volatilityData[hour] === minVolatility) {
                quietestHour = hour;
                break;
            }
        }
        console.log('Волатильность по часам (UTC):');
        for (let hour = 0; hour < 24; hour++) {
            const vol = this.volatilityData[hour];
            const marker = hour === quietestHour ? ' ← САМОЕ СПОКОЙНОЕ' :
                hour === currentHour ? ' ← СЕЙЧАС' : '';
            console.log(`${hour.toString().padStart(2, '0')}:00 - ${vol.toFixed(4)}${marker}`);
        }
        console.log(`\nСамое спокойное время: ${quietestHour}:00 UTC (волатильность: ${minVolatility.toFixed(4)})`);
        console.log(`Текущее время: ${currentHour}:00 UTC (волатильность: ${this.volatilityData[currentHour].toFixed(4)})`);
        const isGoodTime = Math.abs(currentHour - quietestHour) <= 1;
        console.log(`Подходящее время для торговли: ${isGoodTime ? 'ДА' : 'НЕТ'}\n`);
        return { quietestHour, currentHour, isGoodTime, minVolatility };
    }
    // Расчет операций балансировки
    calculateRebalanceOperations(currentPortfolio, desiredPortfolio) {
        console.log('🔄 Расчет операций балансировки...\n');
        const operations = [];
        const totalValue = currentPortfolio.totalValue;
        // Создаем карту текущих позиций
        const currentPositions = new Map();
        for (const position of currentPortfolio.positions) {
            currentPositions.set(position.ticker, position);
        }
        console.log('Сравнение текущего и желаемого портфеля:');
        console.log('Тикер'.padEnd(8) + 'Текущий'.padEnd(12) + 'Желаемый'.padEnd(12) + 'Разница'.padEnd(12) + 'Действие');
        console.log('-'.repeat(60));
        for (const [ticker, desiredPercent] of Object.entries(desiredPortfolio.portfolio)) {
            const currentPosition = currentPositions.get(ticker);
            const currentPercent = currentPosition ? currentPosition.percentage : 0;
            const percentDiff = desiredPercent - currentPercent;
            let action = 'НЕТ';
            if (Math.abs(percentDiff) > 2) { // Порог 2%
                const targetValue = (desiredPercent / 100) * totalValue;
                const currentValue = currentPosition ? currentPosition.value : 0;
                const valueDiff = targetValue - currentValue;
                if (Math.abs(valueDiff) > 10000) { // Минимум 10k рублей
                    action = valueDiff > 0 ? `КУПИТЬ ${Math.abs(valueDiff).toFixed(0)} RUB` : `ПРОДАТЬ ${Math.abs(valueDiff).toFixed(0)} RUB`;
                    operations.push({
                        ticker,
                        action: valueDiff > 0 ? 'BUY' : 'SELL',
                        currentPercent,
                        desiredPercent,
                        percentDiff,
                        valueDiff: Math.abs(valueDiff),
                        priority: Math.abs(percentDiff)
                    });
                }
            }
            console.log(ticker.padEnd(8) +
                `${currentPercent.toFixed(1)}%`.padEnd(12) +
                `${desiredPercent.toFixed(1)}%`.padEnd(12) +
                `${percentDiff > 0 ? '+' : ''}${percentDiff.toFixed(1)}%`.padEnd(12) +
                action);
        }
        console.log(`\nВсего операций: ${operations.length}\n`);
        return operations;
    }
    // Демонстрация полного цикла балансировки
    async demonstrateBalancing() {
        console.log('🤖 === ДЕМОНСТРАЦИЯ БОТА-БАЛАНСИРОВЩИКА ТИНЬКОФФ ===\n');
        console.log(`Режим: ${BALANCER_CONFIG.SAFETY.DRY_RUN ? 'ТЕСТОВЫЙ (DRY RUN)' : 'БОЕВОЙ'}`);
        console.log(`Фондов для анализа: ${Object.keys(this.etfData).length}`);
        console.log(`Общая стоимость портфеля: ${(this.currentPortfolio.totalValue / 1000000).toFixed(1)} млн RUB\n`);
        // 1. Расчет желаемого портфеля
        const desired = this.calculateDesiredPortfolio();
        // 2. Анализ времени торговли
        const timing = this.analyzeMarketTiming();
        // 3. Расчет операций
        const operations = this.calculateRebalanceOperations(this.currentPortfolio, desired);
        // 4. Симуляция выполнения
        if (operations.length > 0) {
            console.log('💼 Выполнение операций балансировки:');
            if (!timing.isGoodTime) {
                console.log('⏳ Ожидание более подходящего времени для торговли...');
                console.log(`Рекомендуется торговать в ${timing.quietestHour}:00 UTC\n`);
            }
            else {
                console.log('✅ Время подходит для торговли\n');
            }
            for (const [index, operation] of operations.entries()) {
                console.log(`${index + 1}. ${operation.action} ${operation.ticker}: ${operation.valueDiff.toFixed(0)} RUB`);
                console.log(`   Изменение: ${operation.currentPercent.toFixed(1)}% → ${operation.desiredPercent.toFixed(1)}%`);
                if (BALANCER_CONFIG.SAFETY.DRY_RUN) {
                    console.log('   [DRY RUN] Операция симулирована ✓');
                }
                else {
                    console.log('   [РЕАЛЬНАЯ ТОРГОВЛЯ] Ордер отправлен ✓');
                }
                // Симуляция задержки
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        else {
            console.log('✅ Портфель уже сбалансирован, операции не требуются');
        }
        console.log('\n🎯 === БАЛАНСИРОВКА ЗАВЕРШЕНА ===');
        console.log('\nПреимущества данной стратегии:');
        console.log('• Автоматическое следование за рынком');
        console.log('• Покупка растущих фондов, продажа падающих');
        console.log('• Торговля в оптимальное время');
        console.log('• Минимизация комиссий и проскальзываний');
        console.log('• Диверсификация по всем фондам Тинькофф');
        return {
            success: true,
            operations: operations.length,
            timing: timing.isGoodTime ? 'optimal' : 'waiting',
            portfolioValue: this.currentPortfolio.totalValue
        };
    }
}
// Запуск демонстрации
async function runDemo() {
    const demo = new DemoBalancer();
    await demo.demonstrateBalancing();
}
// Запуск если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    runDemo().catch(console.error);
}
export { DemoBalancer, runDemo };
