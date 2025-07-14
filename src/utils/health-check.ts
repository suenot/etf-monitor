import type { ApiResponse, FullEtfInfo, QueryResult } from '../types/index.js';
// health-check.js - Утилита для проверки состояния системы
import 'dotenv/config';
import { db } from '../database/client.js';
import { tinkoffApi } from '../services/tinkoff-api.js';
import { scraper } from '../services/scraper.js';

class HealthCheck {
    private checks: any[] = [];
    private results: any[] = [];
    constructor() {
        this.checks = [];
        this.results = [] as any[];
    }

    // Проверка подключения к базе данных
    async checkDatabase() {
        try {
            await db.connect();
            const result = await db.query('SELECT NOW() as current_time');
            
            if (result.rows.length > 0) {
                return {
                    status: 'healthy',
                    message: 'База данных доступна',
                    details: {
                        currentTime: result.rows[0].current_time,
                        connected: true
                    }
                };
            } else {
                throw new Error('Нет ответа от базы данных');
            }
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: 'Ошибка подключения к базе данных',
                error: error.message
            };
        }
    }

    // Проверка Tinkoff API
    async checkTinkoffApi() {
        try {
            await tinkoffApi.connect();
            const etfs = await tinkoffApi.getEtfs();
            
            if (etfs && etfs.length > 0) {
                return {
                    status: 'healthy',
                    message: 'Tinkoff API доступен',
                    details: {
                        etfsCount: etfs.length,
                        connected: true
                    }
                };
            } else {
                throw new Error('API вернул пустой список ETF');
            }
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: 'Ошибка подключения к Tinkoff API',
                error: error.message
            };
        } finally {
            await tinkoffApi.disconnect();
        }
    }

    // Проверка доступности сайта T-Capital
    async checkTCapitalSite() {
        try {
            const isAvailable = await scraper.checkSiteAvailability();
            
            if (isAvailable) {
                return {
                    status: 'healthy',
                    message: 'Сайт T-Capital доступен',
                    details: {
                        available: true
                    }
                };
            } else {
                throw new Error('Сайт недоступен');
            }
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: 'Ошибка доступа к сайту T-Capital',
                error: error.message
            };
        } finally {
            await scraper.close();
        }
    }

    // Проверка актуальности данных
    async checkDataFreshness() {
        try {
            // Проверяем последние данные ETF
            const etfResult = await db.query(`
                SELECT MAX(captured_at) as last_etf_update
                FROM etf_snapshot
            `);

            // Проверяем последние данные инвесторов
            const investorsResult = await db.query(`
                SELECT MAX(captured_at) as last_investors_update
                FROM investors_snapshot
            `);

            const now = new Date();
            const etfLastUpdate = etfResult.rows[0]?.last_etf_update;
            const investorsLastUpdate = investorsResult.rows[0]?.last_investors_update;

            const etfAge = etfLastUpdate ? ((now as any) - (new Date(etfLastUpdate) as any)) / (1000 * 60) : null; // в минутах
            const investorsAge = investorsLastUpdate ? ((now as any) - (new Date(investorsLastUpdate) as any)) / (1000 * 60) : null;

            const warnings = [];
            
            // ETF данные должны обновляться каждые 5-10 минут
            if (!etfLastUpdate) {
                warnings.push('Нет данных ETF');
            } else if (etfAge > 30) {
                warnings.push(`Данные ETF устарели (${Math.round(etfAge)} минут назад)`);
            }

            // Данные инвесторов должны обновляться каждые 30-60 минут
            if (!investorsLastUpdate) {
                warnings.push('Нет данных об инвесторах');
            } else if (investorsAge > 120) {
                warnings.push(`Данные инвесторов устарели (${Math.round(investorsAge)} минут назад)`);
            }

            const status = warnings.length === 0 ? 'healthy' : 'warning';

            return {
                status,
                message: warnings.length === 0 ? 'Данные актуальны' : 'Обнаружены проблемы с актуальностью данных',
                details: {
                    etfLastUpdate,
                    investorsLastUpdate,
                    etfAgeMinutes: etfAge ? Math.round(etfAge) : null,
                    investorsAgeMinutes: investorsAge ? Math.round(investorsAge) : null
                },
                warnings
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: 'Ошибка при проверке актуальности данных',
                error: error.message
            };
        }
    }

    // Проверка объема данных
    async checkDataVolume() {
        try {
            const stats = await db.query(`
                SELECT 
                    (SELECT COUNT(DISTINCT figi) FROM etf_snapshot) as unique_etfs,
                    (SELECT COUNT(*) FROM etf_snapshot) as etf_snapshots,
                    (SELECT COUNT(*) FROM investors_snapshot) as investors_snapshots,
                    (SELECT COUNT(DISTINCT figi) FROM investors_snapshot) as etfs_with_investors
            `);

            const data = stats.rows[0];
            const warnings = [];

            if (data.unique_etfs < 10) {
                warnings.push(`Мало ETF в базе (${data.unique_etfs})`);
            }

            if (data.etf_snapshots < 50) {
                warnings.push(`Мало снимков ETF (${data.etf_snapshots})`);
            }

            if (data.etfs_with_investors < 5) {
                warnings.push(`Мало данных об инвесторах (${data.etfs_with_investors} ETF)`);
            }

            const status = warnings.length === 0 ? 'healthy' : 'warning';

            return {
                status,
                message: warnings.length === 0 ? 'Объем данных в норме' : 'Недостаточный объем данных',
                details: data,
                warnings
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: 'Ошибка при проверке объема данных',
                error: error.message
            };
        }
    }

    // Выполнение всех проверок
    async runAllChecks() {
        console.log('=== Проверка состояния системы ETF Monitor ===\n');

        const checks = [
            { name: 'database', func: this.checkDatabase, description: 'База данных' },
            { name: 'tinkoffApi', func: this.checkTinkoffApi, description: 'Tinkoff API' },
            { name: 'tCapitalSite', func: this.checkTCapitalSite, description: 'Сайт T-Capital' },
            { name: 'dataFreshness', func: this.checkDataFreshness, description: 'Актуальность данных' },
            { name: 'dataVolume', func: this.checkDataVolume, description: 'Объем данных' }
        ];

        const results = {};
        let overallStatus = 'healthy';

        for (const check of checks) {
            console.log(`Проверка: ${check.description}...`);
            
            try {
                const result = await check.func.call(this);
                results[(check as any).name] = result;

                const statusIcon = result.status === 'healthy' ? '✅' : 
                                 result.status === 'warning' ? '⚠️' : '❌';
                
                console.log(`${statusIcon} ${result.message}`);
                
                if (result.warnings && result.warnings.length > 0) {
                    result.warnings.forEach(warning => {
                        console.log(`   ⚠️  ${warning}`);
                    });
                }

                if ((result as any).error) {
                    console.log(`   ❌ ${(result as any).error}`);
                }

                if (result.status === 'unhealthy') {
                    overallStatus = 'unhealthy';
                } else if (result.status === 'warning' && overallStatus === 'healthy') {
                    overallStatus = 'warning';
                }

            } catch (error: any) {
                console.log(`❌ Ошибка при выполнении проверки: ${error.message}`);
                results[(check as any).name] = {
                    status: 'unhealthy',
                    message: 'Ошибка выполнения проверки',
                    error: error.message
                };
                overallStatus = 'unhealthy';
            }

            console.log('');
        }

        // Общий статус
        const overallIcon = overallStatus === 'healthy' ? '✅' : 
                           overallStatus === 'warning' ? '⚠️' : '❌';
        
        console.log(`${overallIcon} Общий статус системы: ${overallStatus.toUpperCase()}`);
        console.log(`Время проверки: ${new Date().toISOString()}`);

        return {
            overallStatus,
            timestamp: new Date().toISOString(),
            checks: results
        };
    }

    // Быстрая проверка (только критичные компоненты)
    async quickCheck() {
        console.log('=== Быстрая проверка системы ===\n');

        try {
            // Проверка базы данных
            const dbCheck = await this.checkDatabase();
            console.log(`База данных: ${dbCheck.status === 'healthy' ? '✅' : '❌'} ${dbCheck.message}`);

            // Проверка актуальности данных
            const freshnessCheck = await this.checkDataFreshness();
            console.log(`Актуальность данных: ${freshnessCheck.status === 'healthy' ? '✅' : '⚠️'} ${freshnessCheck.message}`);

            const isHealthy = dbCheck.status === 'healthy' && freshnessCheck.status !== 'unhealthy';
            
            console.log(`\nСистема ${isHealthy ? 'работает' : 'требует внимания'}`);
            
            return isHealthy;

        } catch (error: any) {
            console.log(`❌ Ошибка при быстрой проверке: ${error.message}`);
            return false;
        } finally {
            await db.disconnect();
        }
    }
}

// Экспортируем singleton экземпляр
export const healthCheck = new HealthCheck();

// Запуск проверки если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    
    if (command === 'quick') {
        await healthCheck.quickCheck();
    } else {
        await healthCheck.runAllChecks();
    }
}
