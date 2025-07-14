// fetch-api.js - Скрипт для сбора данных ETF через Tinkoff Invest API
import 'dotenv/config';
import { tinkoffApi } from '../services/tinkoff-api.js';
import { db } from '../database/client.js';
async function fetchEtfData() {
    console.log('=== Начало сбора данных ETF через API ===');
    const startTime = Date.now();
    try {
        // Получаем все ETF с детальной информацией
        const etfsData = await tinkoffApi.getAllEtfsWithDetails();
        const capturedAt = new Date();
        console.log(`Получено ${etfsData.length} ETF фондов, сохранение в базу данных...`);
        let savedCount = 0;
        let errorCount = 0;
        // Сохраняем данные в базу
        for (const etfData of etfsData) {
            try {
                const result = await db.saveEtfSnapshot(etfData.basic.figi, etfData, capturedAt);
                if (result.rows.length > 0) {
                    savedCount++;
                    console.log(`✓ Сохранен ETF: ${etfData.basic.figi} (${etfData.basic.name})`);
                }
                else {
                    console.log(`- Дубликат ETF: ${etfData.basic.figi} (уже существует)`);
                }
            }
            catch (saveError) {
                errorCount++;
                console.error(`✗ Ошибка сохранения ETF ${etfData.basic.figi}:`, saveError.message);
            }
        }
        const duration = (Date.now() - startTime) / 1000;
        console.log('=== Результаты сбора данных ETF ===');
        console.log(`Время выполнения: ${duration.toFixed(2)} секунд`);
        console.log(`Всего обработано: ${etfsData.length}`);
        console.log(`Успешно сохранено: ${savedCount}`);
        console.log(`Ошибок: ${errorCount}`);
        console.log(`Время снимка: ${capturedAt.toISOString()}`);
        return {
            success: true,
            processed: etfsData.length,
            saved: savedCount,
            errors: errorCount,
            capturedAt,
            duration
        };
    }
    catch (error) {
        console.error('Критическая ошибка при сборе данных ETF:', error);
        return {
            success: false,
            error: error.message,
            duration: (Date.now() - startTime) / 1000
        };
    }
    finally {
        // Закрываем соединения
        await tinkoffApi.disconnect();
        await db.disconnect();
    }
}
// Функция для получения статистики по ETF
async function getEtfStats() {
    try {
        const stats = await db.query(`
            SELECT 
                COUNT(DISTINCT figi) as unique_etfs,
                COUNT(*) as total_snapshots,
                MIN(captured_at) as first_snapshot,
                MAX(captured_at) as last_snapshot
            FROM etf_snapshot
        `);
        const latestData = await db.query(`
            SELECT 
                figi,
                data->>'name' as name,
                data->>'ticker' as ticker,
                captured_at
            FROM etf_snapshot 
            WHERE captured_at = (
                SELECT MAX(captured_at) FROM etf_snapshot
            )
            ORDER BY data->>'name'
        `);
        console.log('=== Статистика ETF в базе данных ===');
        console.log(`Уникальных ETF: ${stats.rows[0].unique_etfs}`);
        console.log(`Всего снимков: ${stats.rows[0].total_snapshots}`);
        console.log(`Первый снимок: ${stats.rows[0].first_snapshot}`);
        console.log(`Последний снимок: ${stats.rows[0].last_snapshot}`);
        if (latestData.rows.length > 0) {
            console.log('\n=== Последние данные ETF ===');
            latestData.rows.forEach(row => {
                console.log(`${row.ticker}: ${row.name}`);
            });
        }
        return stats.rows[0];
    }
    catch (error) {
        console.error('Ошибка при получении статистики:', error);
        return null;
    }
    finally {
        await db.disconnect();
    }
}
// Запуск скрипта если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    if (command === 'stats') {
        await getEtfStats();
    }
    else {
        await fetchEtfData();
    }
}
export { fetchEtfData, getEtfStats };
