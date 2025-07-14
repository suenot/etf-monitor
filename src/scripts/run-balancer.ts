import type { ApiResponse, FullEtfInfo, QueryResult } from '../types/index.js';
// Скрипт запуска бота-балансировщика
import 'dotenv/config';
import { balancer } from '../services/balancer.js';
import { portfolioCalculator } from '../services/portfolio-calculator.js';
import { marketTiming } from '../services/market-timing.js';
import { BALANCER_CONFIG } from '../config/balancer-config.js';

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => {
    console.log('\nПолучен сигнал SIGINT, завершение работы...');
    balancer.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nПолучен сигнал SIGTERM, завершение работы...');
    balancer.stop();
    process.exit(0);
});

// Функция для отображения статуса
async function showStatus() {
    try {
        console.log('\n=== Статус балансировщика ===');
        
        const stats = balancer.getStats();
        console.log(`Статус: ${stats.isRunning ? 'Работает' : 'Остановлен'}`);
        console.log(`Аккаунт: ${stats.accountId || 'Не инициализирован'}`);
        console.log(`Режим: ${stats.config.dryRun ? 'Тестовый (DRY RUN)' : 'Боевой'}`);
        console.log(`Интервал: ${stats.config.interval / 1000} секунд`);
        console.log(`Фондов в портфеле: ${stats.config.etfsCount}`);
        console.log(`Всего балансировок: ${stats.totalBalances}`);
        console.log(`Успешность: ${(stats.successRate as any).toFixed(1)}%`);
        
        if (stats.lastBalance) {
            console.log(`Последняя балансировка: ${stats.lastBalance.timestamp.toLocaleString()}`);
            console.log(`Операций: ${stats.lastBalance.successfulOperations}/${stats.lastBalance.totalOperations}`);
        }
        
        // Показываем текущий желаемый портфель
        console.log('\n=== Текущий желаемый портфель ===');
        try {
            const desired = await portfolioCalculator.calculateDesiredPortfolio();
            for (const [ticker, percent] of Object.entries(desired.portfolio)) {
                console.log(`${ticker}: ${(percent as any).toFixed(2)}%`);
            }
            console.log(`Общий market cap: ${(desired.totalMarketCap / 1000000000).toFixed(2)} млрд RUB`);
        } catch (error: any) {
            console.log('Ошибка получения желаемого портфеля:', error.message);
        }
        
        // Показываем анализ времени торговли
        console.log('\n=== Анализ времени торговли ===');
        try {
            const timing = await marketTiming.findQuietestTradingTime((BALANCER_CONFIG.TINKOFF_ETFS[0] as string));
            console.log(`Самое спокойное время: ${timing.quietestHour}:00 UTC`);
            console.log(`Минимальная волатильность: ${(timing.minVolatility as any).toFixed(4)}`);
            console.log(`Текущее время подходит: ${timing.isQuietTime ? 'Да' : 'Нет'}`);
            console.log(`Рекомендация: ${timing.recommendation.reason}`);
        } catch (error: any) {
            console.log('Ошибка анализа времени:', error.message);
        }
        
    } catch (error: any) {
        console.error('Ошибка получения статуса:', error);
    }
}

// Функция для выполнения одной балансировки
async function runOnce() {
    try {
        console.log('Выполнение одной балансировки...');
        
        await balancer.initialize();
        const result = await balancer.rebalance();
        
        if (result.success) {
            console.log('✓ Балансировка выполнена успешно');
        } else {
            console.log(`✗ Балансировка не выполнена: ${(result as any).reason || (result as any).error}`);
        }
        
        return result;
        
    } catch (error: any) {
        console.error('Ошибка выполнения балансировки:', error);
        return { success: false, error: error.message };
    }
}

// Функция для запуска автоматического режима
async function runAuto() {
    try {
        console.log('Запуск автоматического режима балансировки...');
        
        await balancer.initialize();
        await balancer.startAutoRebalancing();
        
        // Показываем статус каждые 10 минут
        setInterval(showStatus, 10 * 60 * 1000);
        
        console.log('Балансировщик запущен. Нажмите Ctrl+C для остановки.');
        
        // Бесконечный цикл для поддержания работы
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
    } catch (error: any) {
        console.error('Ошибка запуска автоматического режима:', error);
        process.exit(1);
    }
}

// Функция для тестирования конфигурации
async function testConfig() {
    try {
        console.log('Тестирование конфигурации...');
        
        // Проверяем подключение к API
        console.log('Проверка подключения к Tinkoff Invest API...');
        await balancer.initialize();
        console.log('✓ Подключение к API успешно');
        
        // Проверяем получение данных о фондах
        console.log('Проверка получения данных о фондах...');
        const desired = await portfolioCalculator.calculateDesiredPortfolio();
        console.log(`✓ Получены данные о ${Object.keys(desired.portfolio).length} фондах`);
        
        // Проверяем анализ времени торговли
        console.log('Проверка анализа времени торговли...');
        const timing = await marketTiming.findQuietestTradingTime((BALANCER_CONFIG.TINKOFF_ETFS[0] as string).slice(0, 3));
        console.log('✓ Анализ времени торговли работает');
        
        // Проверяем получение портфеля
        console.log('Проверка получения текущего портфеля...');
        const portfolio = await balancer.getCurrentPortfolio();
        console.log(`✓ Получен портфель: ${(portfolio.totalValue as any).toFixed(2)} RUB`);
        
        console.log('\n✓ Все проверки пройдены успешно!');
        
    } catch (error: any) {
        console.error('✗ Ошибка тестирования:', error);
        process.exit(1);
    }
}

// Основная функция
async function main() {
    const command = process.argv[2];
    
    console.log('=== Бот-балансировщик портфеля Тинькофф ===');
    console.log(`Режим: ${BALANCER_CONFIG.SAFETY.DRY_RUN ? 'ТЕСТОВЫЙ (DRY RUN)' : 'БОЕВОЙ'}`);
    console.log(`Фондов для балансировки: ${(BALANCER_CONFIG.TINKOFF_ETFS[0] as string).length}`);
    
    switch (command) {
        case 'status':
            await showStatus();
            break;
            
        case 'once':
            await runOnce();
            break;
            
        case 'auto':
            await runAuto();
            break;
            
        case 'test':
            await testConfig();
            break;
            
        default:
            console.log('\nИспользование:');
            console.log('  npm run balancer status  - Показать статус');
            console.log('  npm run balancer once    - Выполнить одну балансировку');
            console.log('  npm run balancer auto    - Запустить автоматический режим');
            console.log('  npm run balancer test    - Тестировать конфигурацию');
            console.log('\nПеременные окружения:');
            console.log('  TINKOFF_TOKEN - Токен Tinkoff Invest API');
            console.log('  ACCOUNT_ID    - ID аккаунта (или BROKER/ISS)');
            console.log('  DRY_RUN=true  - Тестовый режим без реальных сделок');
            break;
    }
}

// Запуск если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Критическая ошибка:', error);
        process.exit(1);
    });
}
