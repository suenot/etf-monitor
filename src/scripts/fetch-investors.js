// fetch-investors.js - Скрипт для сбора данных об инвесторах через скрейпинг
import 'dotenv/config';
import { scraper } from '../services/scraper.js';
import { db } from '../database/client.js';

async function fetchInvestorsData() {
    console.log('=== Начало сбора данных об инвесторах ===');
    const startTime = Date.now();
    
    try {
        // Проверяем доступность сайта
        const siteAvailable = await scraper.checkSiteAvailability();
        if (!siteAvailable) {
            throw new Error('Сайт T-Capital недоступен');
        }
        
        // Получаем список уникальных FIGI из базы данных
        const figis = await db.getUniqueFigis();
        
        if (figis.length === 0) {
            console.log('В базе данных нет ETF фондов. Сначала запустите сбор данных API.');
            return {
                success: false,
                error: 'Нет данных ETF в базе'
            };
        }
        
        console.log(`Найдено ${figis.length} ETF фондов для обработки`);
        
        // Получаем данные об инвесторах
        const investorsData = await scraper.getAllInvestorsData(figis);
        
        console.log(`Получены данные об инвесторах для ${investorsData.length} фондов, сохранение в базу данных...`);
        
        let savedCount = 0;
        let errorCount = 0;
        
        // Сохраняем данные в базу
        for (const data of investorsData) {
            try {
                const result = await db.saveInvestorsSnapshot(
                    data.figi,
                    data.investors,
                    data.capturedAt
                );
                
                if (result.rows.length > 0) {
                    savedCount++;
                    console.log(`✓ Сохранены данные инвесторов: ${data.figi} (${data.investors} инвесторов)`);
                } else {
                    console.log(`- Дубликат данных инвесторов: ${data.figi}`);
                }
                
            } catch (saveError) {
                errorCount++;
                console.error(`✗ Ошибка сохранения данных инвесторов ${data.figi}:`, saveError.message);
            }
        }
        
        const duration = (Date.now() - startTime) / 1000;
        
        console.log('=== Результаты сбора данных об инвесторах ===');
        console.log(`Время выполнения: ${duration.toFixed(2)} секунд`);
        console.log(`Всего обработано: ${figis.length}`);
        console.log(`Успешно получено: ${investorsData.length}`);
        console.log(`Успешно сохранено: ${savedCount}`);
        console.log(`Ошибок: ${errorCount}`);
        
        return {
            success: true,
            processed: figis.length,
            received: investorsData.length,
            saved: savedCount,
            errors: errorCount,
            duration
        };
        
    } catch (error) {
        console.error('Критическая ошибка при сборе данных об инвесторах:', error);
        return {
            success: false,
            error: error.message,
            duration: (Date.now() - startTime) / 1000
        };
    } finally {
        // Закрываем соединения
        await scraper.close();
        await db.disconnect();
    }
}

// Функция для получения статистики по инвесторам
async function getInvestorsStats() {
    try {
        const stats = await db.query(`
            SELECT 
                COUNT(DISTINCT figi) as unique_etfs,
                COUNT(*) as total_snapshots,
                MIN(captured_at) as first_snapshot,
                MAX(captured_at) as last_snapshot,
                AVG(investors) as avg_investors,
                MIN(investors) as min_investors,
                MAX(investors) as max_investors
            FROM investors_snapshot
        `);
        
        const latestData = await db.query(`
            SELECT 
                i.figi,
                e.data->>'name' as name,
                e.data->>'ticker' as ticker,
                i.investors,
                i.captured_at
            FROM investors_snapshot i
            LEFT JOIN (
                SELECT DISTINCT ON (figi) figi, data
                FROM etf_snapshot
                ORDER BY figi, captured_at DESC
            ) e ON i.figi = e.figi
            WHERE i.captured_at = (
                SELECT MAX(captured_at) FROM investors_snapshot
            )
            ORDER BY i.investors DESC
        `);
        
        console.log('=== Статистика инвесторов в базе данных ===');
        console.log(`ETF с данными об инвесторах: ${stats.rows[0].unique_etfs}`);
        console.log(`Всего снимков: ${stats.rows[0].total_snapshots}`);
        console.log(`Первый снимок: ${stats.rows[0].first_snapshot}`);
        console.log(`Последний снимок: ${stats.rows[0].last_snapshot}`);
        console.log(`Среднее количество инвесторов: ${Math.round(stats.rows[0].avg_investors)}`);
        console.log(`Минимальное количество: ${stats.rows[0].min_investors}`);
        console.log(`Максимальное количество: ${stats.rows[0].max_investors}`);
        
        if (latestData.rows.length > 0) {
            console.log('\n=== Топ-10 ETF по количеству инвесторов ===');
            latestData.rows.slice(0, 10).forEach((row, index) => {
                console.log(`${index + 1}. ${row.ticker || row.figi}: ${row.investors.toLocaleString()} инвесторов`);
            });
        }
        
        return stats.rows[0];
        
    } catch (error) {
        console.error('Ошибка при получении статистики инвесторов:', error);
        return null;
    } finally {
        await db.disconnect();
    }
}

// Запуск скрипта если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    
    if (command === 'stats') {
        await getInvestorsStats();
    } else {
        await fetchInvestorsData();
    }
}

export { fetchInvestorsData, getInvestorsStats };
