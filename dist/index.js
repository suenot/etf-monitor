// index.ts - Главный файл приложения с планировщиком задач
import 'dotenv/config';
import cron from 'node-cron';
import { fetchEtfData } from './scripts/fetch-api.js';
import { fetchInvestorsData } from './scripts/fetch-investors.js';
class EtfMonitor {
    etfFetchInterval;
    investorsFetchInterval;
    isRunning = false;
    jobs = [];
    constructor() {
        this.etfFetchInterval = process.env.ETF_FETCH_INTERVAL || '5';
        this.investorsFetchInterval = process.env.INVESTORS_FETCH_INTERVAL || '30';
    }
    async start() {
        if (this.isRunning) {
            console.log('Мониторинг ETF уже запущен');
            return;
        }
        console.log('=== Запуск мониторинга ETF фондов Т-Капитал ===');
        console.log(`Интервал сбора данных ETF: каждые ${this.etfFetchInterval} минут`);
        console.log(`Интервал сбора данных инвесторов: каждые ${this.investorsFetchInterval} минут`);
        try {
            // Выполняем начальный сбор данных
            console.log('\n--- Начальный сбор данных ETF ---');
            await fetchEtfData();
            console.log('\n--- Начальный сбор данных инвесторов ---');
            await fetchInvestorsData();
            // Настраиваем планировщик задач
            this.setupScheduler();
            this.isRunning = true;
            console.log('\n=== Мониторинг ETF успешно запущен ===');
            console.log('Для остановки нажмите Ctrl+C');
        }
        catch (error) {
            console.error('Ошибка при запуске мониторинга:', error);
            process.exit(1);
        }
    }
    setupScheduler() {
        // Планировщик для сбора данных ETF
        const etfCronPattern = `*/${this.etfFetchInterval} * * * *`;
        const etfJob = cron.schedule(etfCronPattern, async () => {
            console.log('\n--- Плановый сбор данных ETF ---');
            try {
                const result = await fetchEtfData();
                if (result.success) {
                    console.log(`✓ Сбор данных ETF завершен: ${result.saved} сохранено`);
                }
                else {
                    console.error(`✗ Ошибка сбора данных ETF: ${result.error}`);
                }
            }
            catch (error) {
                console.error('Ошибка в планировщике ETF:', error);
            }
        }, {
            scheduled: false
        });
        // Планировщик для сбора данных инвесторов
        const investorsCronPattern = `*/${this.investorsFetchInterval} * * * *`;
        const investorsJob = cron.schedule(investorsCronPattern, async () => {
            console.log('\n--- Плановый сбор данных инвесторов ---');
            try {
                const result = await fetchInvestorsData();
                if (result.success) {
                    console.log(`✓ Сбор данных инвесторов завершен: ${result.saved} сохранено`);
                }
                else {
                    console.error(`✗ Ошибка сбора данных инвесторов: ${result.error}`);
                }
            }
            catch (error) {
                console.error('Ошибка в планировщике инвесторов:', error);
            }
        }, {
            scheduled: false
        });
        // Запускаем задачи
        etfJob.start();
        investorsJob.start();
        this.jobs = [etfJob, investorsJob];
        console.log(`Планировщик настроен:`);
        console.log(`- ETF данные: ${etfCronPattern}`);
        console.log(`- Данные инвесторов: ${investorsCronPattern}`);
    }
    async stop() {
        if (!this.isRunning) {
            console.log('Мониторинг ETF не запущен');
            return;
        }
        console.log('\n=== Остановка мониторинга ETF ===');
        // Останавливаем все задачи
        this.jobs.forEach(job => {
            job.stop();
        });
        this.jobs = [];
        this.isRunning = false;
        console.log('Мониторинг ETF остановлен');
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            etfFetchInterval: this.etfFetchInterval,
            investorsFetchInterval: this.investorsFetchInterval,
            activeJobs: this.jobs.length
        };
    }
}
// Создаем экземпляр мониторинга
const monitor = new EtfMonitor();
// Обработка сигналов для корректного завершения
process.on('SIGINT', async () => {
    console.log('\nПолучен сигнал SIGINT, завершение работы...');
    await monitor.stop();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\nПолучен сигнал SIGTERM, завершение работы...');
    await monitor.stop();
    process.exit(0);
});
// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    console.error('Необработанное отклонение промиса:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Необработанное исключение:', error);
    process.exit(1);
});
// Запуск мониторинга если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    monitor.start();
}
export { monitor, EtfMonitor };
