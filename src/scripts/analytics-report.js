// analytics-report.js - Скрипт для генерации аналитических отчетов
import 'dotenv/config';
import { analytics } from '../utils/analytics.js';
import { db } from '../database/client.js';

async function generateFullReport() {
    console.log('=== Генерация полного аналитического отчета ===\n');
    
    try {
        // 1. Общая статистика системы
        console.log('📊 ОБЩАЯ СТАТИСТИКА СИСТЕМЫ');
        console.log('=' .repeat(50));
        
        const systemStats = await analytics.getSystemStats();
        if (systemStats) {
            console.log(`ETF данные:`);
            console.log(`  Уникальных ETF: ${systemStats.etf.unique_etfs}`);
            console.log(`  Всего снимков: ${systemStats.etf.total_snapshots}`);
            console.log(`  Период: ${systemStats.etf.first_snapshot} - ${systemStats.etf.last_snapshot}`);
            
            console.log(`\nДанные об инвесторах:`);
            console.log(`  ETF с данными: ${systemStats.investors.unique_etfs}`);
            console.log(`  Всего снимков: ${systemStats.investors.total_snapshots}`);
            console.log(`  Период: ${systemStats.investors.first_snapshot} - ${systemStats.investors.last_snapshot}`);
        }

        // 2. Сводная статистика по ETF
        console.log('\n\n📈 СВОДНАЯ СТАТИСТИКА ETF');
        console.log('=' .repeat(50));
        
        const summary = await analytics.getEtfSummary();
        if (summary) {
            console.log(`Всего ETF фондов: ${summary.total_etfs}`);
            console.log(`ETF с данными об инвесторах: ${summary.etfs_with_investors}`);
            console.log(`Общее количество инвесторов: ${Number(summary.total_investors).toLocaleString()}`);
            console.log(`Среднее количество инвесторов на ETF: ${Math.round(summary.avg_investors_per_etf)}`);
            console.log(`Минимальное количество инвесторов: ${summary.min_investors}`);
            console.log(`Максимальное количество инвесторов: ${summary.max_investors}`);
        }

        // 3. Топ ETF по количеству инвесторов
        console.log('\n\n🏆 ТОП-15 ETF ПО КОЛИЧЕСТВУ ИНВЕСТОРОВ');
        console.log('=' .repeat(50));
        
        const topEtfs = await analytics.getTopEtfsByInvestors(15);
        if (topEtfs.length > 0) {
            topEtfs.forEach((etf, index) => {
                const name = etf.name || 'Название не указано';
                const ticker = etf.ticker || etf.figi;
                console.log(`${(index + 1).toString().padStart(2)}. ${ticker.padEnd(8)} | ${etf.investors.toLocaleString().padStart(8)} инвесторов | ${name}`);
            });
        }

        // 4. Распределение по валютам
        console.log('\n\n💱 РАСПРЕДЕЛЕНИЕ ETF ПО ВАЛЮТАМ');
        console.log('=' .repeat(50));
        
        const currencies = await analytics.getCurrencyDistribution();
        if (currencies.length > 0) {
            currencies.forEach(curr => {
                console.log(`${curr.currency.padEnd(5)} | ${curr.count.toString().padStart(3)} ETF (${curr.percentage}%)`);
            });
        }

        // 5. Быстрорастущие ETF за последнюю неделю
        console.log('\n\n🚀 БЫСТРОРАСТУЩИЕ ETF (7 ДНЕЙ)');
        console.log('=' .repeat(50));
        
        const growingEtfs = await analytics.getFastestGrowingEtfs(7, 10);
        if (growingEtfs.length > 0) {
            console.log('Тикер    | Рост инвесторов | Рост %  | Текущее количество');
            console.log('-'.repeat(65));
            growingEtfs.forEach(etf => {
                const ticker = (etf.ticker || etf.figi).padEnd(8);
                const growth = `+${etf.absolute_growth}`.padStart(8);
                const percentage = `+${etf.percentage_growth}%`.padStart(8);
                const current = etf.latest_investors.toLocaleString().padStart(8);
                console.log(`${ticker} | ${growth}       | ${percentage} | ${current}`);
            });
        } else {
            console.log('Нет данных о росте за последние 7 дней');
        }

        // 6. Быстрорастущие ETF за последний месяц
        console.log('\n\n📅 БЫСТРОРАСТУЩИЕ ETF (30 ДНЕЙ)');
        console.log('=' .repeat(50));
        
        const monthlyGrowth = await analytics.getFastestGrowingEtfs(30, 10);
        if (monthlyGrowth.length > 0) {
            console.log('Тикер    | Рост инвесторов | Рост %  | Текущее количество');
            console.log('-'.repeat(65));
            monthlyGrowth.forEach(etf => {
                const ticker = (etf.ticker || etf.figi).padEnd(8);
                const growth = `+${etf.absolute_growth}`.padStart(8);
                const percentage = `+${etf.percentage_growth}%`.padStart(8);
                const current = etf.latest_investors.toLocaleString().padStart(8);
                console.log(`${ticker} | ${growth}       | ${percentage} | ${current}`);
            });
        } else {
            console.log('Нет данных о росте за последние 30 дней');
        }

        console.log('\n=== Отчет завершен ===');
        
    } catch (error) {
        console.error('Ошибка при генерации отчета:', error);
    } finally {
        await db.disconnect();
    }
}

async function generateEtfReport(figi) {
    console.log(`=== Детальный отчет по ETF: ${figi} ===\n`);
    
    try {
        const report = await analytics.getEtfDetailedReport(figi);
        
        if (!report) {
            console.log(`ETF с FIGI ${figi} не найден в базе данных`);
            return;
        }

        // Основная информация
        console.log('📋 ОСНОВНАЯ ИНФОРМАЦИЯ');
        console.log('=' .repeat(40));
        console.log(`FIGI: ${report.figi}`);
        console.log(`Название: ${report.etfData.name || 'Не указано'}`);
        console.log(`Тикер: ${report.etfData.ticker || 'Не указан'}`);
        console.log(`Валюта: ${report.etfData.currency || 'Не указана'}`);
        console.log(`ISIN: ${report.etfData.isin || 'Не указан'}`);

        // Статистика по инвесторам
        if (report.investorsStats.total_snapshots > 0) {
            console.log('\n👥 СТАТИСТИКА ИНВЕСТОРОВ');
            console.log('=' .repeat(40));
            console.log(`Всего снимков: ${report.investorsStats.total_snapshots}`);
            console.log(`Минимум инвесторов: ${report.investorsStats.min_investors}`);
            console.log(`Максимум инвесторов: ${report.investorsStats.max_investors}`);
            console.log(`Среднее количество: ${Math.round(report.investorsStats.avg_investors)}`);
            console.log(`Период наблюдения: ${report.investorsStats.first_snapshot} - ${report.investorsStats.last_snapshot}`);

            // Последние снимки
            if (report.recentInvestors.length > 0) {
                console.log('\n📊 ПОСЛЕДНИЕ СНИМКИ');
                console.log('=' .repeat(40));
                report.recentInvestors.forEach((snapshot, index) => {
                    const date = new Date(snapshot.captured_at).toLocaleString('ru-RU');
                    console.log(`${index + 1}. ${date}: ${snapshot.investors.toLocaleString()} инвесторов`);
                });
            }

            // Динамика роста
            const growth = await analytics.getInvestorsGrowth(figi, 30);
            if (growth.length > 1) {
                console.log('\n📈 ДИНАМИКА РОСТА (30 ДНЕЙ)');
                console.log('=' .repeat(40));
                growth.slice(0, 10).forEach(item => {
                    if (item.growth !== null) {
                        const date = new Date(item.captured_at).toLocaleDateString('ru-RU');
                        const growthStr = item.growth > 0 ? `+${item.growth}` : item.growth.toString();
                        console.log(`${date}: ${item.investors.toLocaleString()} (${growthStr})`);
                    }
                });
            }
        } else {
            console.log('\n👥 ДАННЫЕ ОБ ИНВЕСТОРАХ');
            console.log('=' .repeat(40));
            console.log('Данные об инвесторах отсутствуют');
        }

        console.log('\n=== Отчет завершен ===');
        
    } catch (error) {
        console.error('Ошибка при генерации отчета по ETF:', error);
    } finally {
        await db.disconnect();
    }
}

// Запуск скрипта если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    const figi = process.argv[3];
    
    if (command === 'etf' && figi) {
        await generateEtfReport(figi);
    } else if (command === 'full') {
        await generateFullReport();
    } else {
        console.log('Использование:');
        console.log('  node src/scripts/analytics-report.js full          - полный отчет');
        console.log('  node src/scripts/analytics-report.js etf <FIGI>    - отчет по конкретному ETF');
        console.log('');
        console.log('Примеры:');
        console.log('  node src/scripts/analytics-report.js full');
        console.log('  node src/scripts/analytics-report.js etf BBG004730N88');
    }
}

export { generateFullReport, generateEtfReport };
