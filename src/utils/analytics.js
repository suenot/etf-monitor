// analytics.js - Утилиты для аналитики данных ETF
import { db } from '../database/client.js';

class Analytics {
    // Получение сводной статистики по ETF
    async getEtfSummary() {
        try {
            const query = `
                WITH latest_etf AS (
                    SELECT DISTINCT ON (figi) 
                        figi,
                        data,
                        captured_at
                    FROM etf_snapshot
                    ORDER BY figi, captured_at DESC
                ),
                latest_investors AS (
                    SELECT DISTINCT ON (figi)
                        figi,
                        investors,
                        captured_at
                    FROM investors_snapshot
                    ORDER BY figi, captured_at DESC
                )
                SELECT 
                    COUNT(e.figi) as total_etfs,
                    COUNT(i.figi) as etfs_with_investors,
                    COALESCE(SUM(i.investors), 0) as total_investors,
                    COALESCE(AVG(i.investors), 0) as avg_investors_per_etf,
                    COALESCE(MIN(i.investors), 0) as min_investors,
                    COALESCE(MAX(i.investors), 0) as max_investors
                FROM latest_etf e
                LEFT JOIN latest_investors i ON e.figi = i.figi
            `;
            
            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            console.error('Ошибка при получении сводной статистики ETF:', error);
            return null;
        }
    }

    // Получение топ ETF по количеству инвесторов
    async getTopEtfsByInvestors(limit = 10) {
        try {
            const query = `
                WITH latest_data AS (
                    SELECT DISTINCT ON (i.figi)
                        i.figi,
                        i.investors,
                        e.data->>'name' as name,
                        e.data->>'ticker' as ticker,
                        e.data->>'currency' as currency,
                        i.captured_at
                    FROM investors_snapshot i
                    LEFT JOIN (
                        SELECT DISTINCT ON (figi) figi, data
                        FROM etf_snapshot
                        ORDER BY figi, captured_at DESC
                    ) e ON i.figi = e.figi
                    ORDER BY i.figi, i.captured_at DESC
                )
                SELECT *
                FROM latest_data
                WHERE investors > 0
                ORDER BY investors DESC
                LIMIT $1
            `;
            
            const result = await db.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.error('Ошибка при получении топ ETF по инвесторам:', error);
            return [];
        }
    }

    // Получение динамики роста инвесторов
    async getInvestorsGrowth(figi, days = 30) {
        try {
            const query = `
                SELECT 
                    figi,
                    investors,
                    captured_at,
                    LAG(investors) OVER (ORDER BY captured_at) as prev_investors,
                    investors - LAG(investors) OVER (ORDER BY captured_at) as growth
                FROM investors_snapshot
                WHERE figi = $1 
                    AND captured_at >= NOW() - INTERVAL '${days} days'
                ORDER BY captured_at DESC
            `;
            
            const result = await db.query(query, [figi]);
            return result.rows;
        } catch (error) {
            console.error(`Ошибка при получении динамики роста для ${figi}:`, error);
            return [];
        }
    }

    // Получение статистики по валютам ETF
    async getCurrencyDistribution() {
        try {
            const query = `
                SELECT 
                    data->>'currency' as currency,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
                FROM (
                    SELECT DISTINCT ON (figi) figi, data
                    FROM etf_snapshot
                    ORDER BY figi, captured_at DESC
                ) latest
                WHERE data->>'currency' IS NOT NULL
                GROUP BY data->>'currency'
                ORDER BY count DESC
            `;
            
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Ошибка при получении распределения по валютам:', error);
            return [];
        }
    }

    // Получение ETF с наибольшим ростом инвесторов за период
    async getFastestGrowingEtfs(days = 7, limit = 10) {
        try {
            const query = `
                WITH growth_data AS (
                    SELECT 
                        figi,
                        FIRST_VALUE(investors) OVER (PARTITION BY figi ORDER BY captured_at DESC) as latest_investors,
                        FIRST_VALUE(investors) OVER (PARTITION BY figi ORDER BY captured_at ASC) as earliest_investors,
                        COUNT(*) OVER (PARTITION BY figi) as snapshots_count
                    FROM investors_snapshot
                    WHERE captured_at >= NOW() - INTERVAL '${days} days'
                ),
                etf_growth AS (
                    SELECT DISTINCT
                        g.figi,
                        g.latest_investors,
                        g.earliest_investors,
                        g.latest_investors - g.earliest_investors as absolute_growth,
                        CASE 
                            WHEN g.earliest_investors > 0 
                            THEN ROUND((g.latest_investors - g.earliest_investors) * 100.0 / g.earliest_investors, 2)
                            ELSE 0
                        END as percentage_growth,
                        e.data->>'name' as name,
                        e.data->>'ticker' as ticker
                    FROM growth_data g
                    LEFT JOIN (
                        SELECT DISTINCT ON (figi) figi, data
                        FROM etf_snapshot
                        ORDER BY figi, captured_at DESC
                    ) e ON g.figi = e.figi
                    WHERE g.snapshots_count >= 2
                )
                SELECT *
                FROM etf_growth
                WHERE absolute_growth > 0
                ORDER BY percentage_growth DESC
                LIMIT $1
            `;
            
            const result = await db.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.error('Ошибка при получении быстрорастущих ETF:', error);
            return [];
        }
    }

    // Получение детального отчета по ETF
    async getEtfDetailedReport(figi) {
        try {
            // Основная информация об ETF
            const etfInfo = await db.query(`
                SELECT data
                FROM etf_snapshot
                WHERE figi = $1
                ORDER BY captured_at DESC
                LIMIT 1
            `, [figi]);

            if (etfInfo.rows.length === 0) {
                return null;
            }

            // Статистика по инвесторам
            const investorsStats = await db.query(`
                SELECT 
                    COUNT(*) as total_snapshots,
                    MIN(investors) as min_investors,
                    MAX(investors) as max_investors,
                    AVG(investors) as avg_investors,
                    MIN(captured_at) as first_snapshot,
                    MAX(captured_at) as last_snapshot
                FROM investors_snapshot
                WHERE figi = $1
            `, [figi]);

            // Последние 10 снимков инвесторов
            const recentInvestors = await db.query(`
                SELECT investors, captured_at
                FROM investors_snapshot
                WHERE figi = $1
                ORDER BY captured_at DESC
                LIMIT 10
            `, [figi]);

            return {
                figi,
                etfData: etfInfo.rows[0].data,
                investorsStats: investorsStats.rows[0],
                recentInvestors: recentInvestors.rows
            };
        } catch (error) {
            console.error(`Ошибка при получении детального отчета для ${figi}:`, error);
            return null;
        }
    }

    // Получение общей статистики системы
    async getSystemStats() {
        try {
            const etfStats = await db.query(`
                SELECT 
                    COUNT(DISTINCT figi) as unique_etfs,
                    COUNT(*) as total_snapshots,
                    MIN(captured_at) as first_snapshot,
                    MAX(captured_at) as last_snapshot
                FROM etf_snapshot
            `);

            const investorsStats = await db.query(`
                SELECT 
                    COUNT(DISTINCT figi) as unique_etfs,
                    COUNT(*) as total_snapshots,
                    MIN(captured_at) as first_snapshot,
                    MAX(captured_at) as last_snapshot
                FROM investors_snapshot
            `);

            return {
                etf: etfStats.rows[0],
                investors: investorsStats.rows[0]
            };
        } catch (error) {
            console.error('Ошибка при получении статистики системы:', error);
            return null;
        }
    }
}

// Экспортируем singleton экземпляр
export const analytics = new Analytics();
