// client.ts - Клиент для работы с базой данных
import 'dotenv/config';
import pg from 'pg';
import type { FullEtfInfo, QueryResult } from '../types/index.js';

const { Client } = pg;

class DatabaseClient {
    private client: pg.Client | null = null;
    private connectionString: string;

    constructor() {
        this.connectionString = process.env.DATABASE_URL || '';
        if (!this.connectionString) {
            throw new Error('DATABASE_URL не найден в переменных окружения');
        }
    }

    async connect(): Promise<pg.Client> {
        if (!this.client) {
            this.client = new Client({
                connectionString: this.connectionString
            });
            await this.client.connect();
            console.log('Подключение к базе данных установлено');
        }
        return this.client;
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.end();
            this.client = null;
            console.log('Соединение с базой данных закрыто');
        }
    }

    async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const client = await this.connect();
        const result = await client.query(text, params);
        return {
            rows: result.rows as T[],
            rowCount: result.rowCount || 0,
            command: result.command
        };
    }

    // Сохранение снимка ETF
    async saveEtfSnapshot(figi: string, data: FullEtfInfo, capturedAt: Date = new Date()): Promise<QueryResult<{ id: number }>> {
        const query = `
            INSERT INTO etf_snapshot(figi, data, captured_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (figi, captured_at) DO NOTHING
            RETURNING id
        `;
        return this.query<{ id: number }>(query, [figi, JSON.stringify(data), capturedAt]);
    }

    // Сохранение данных об инвесторах
    async saveInvestorsSnapshot(figi: string, investors: number, capturedAt: Date = new Date()): Promise<QueryResult<{ id: number }>> {
        const query = `
            INSERT INTO investors_snapshot(figi, investors, captured_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (figi, captured_at) DO NOTHING
            RETURNING id
        `;
        return this.query<{ id: number }>(query, [figi, investors, capturedAt]);
    }

    // Получение списка уникальных FIGI
    async getUniqueFigis(): Promise<string[]> {
        const query = 'SELECT DISTINCT figi FROM etf_snapshot ORDER BY figi';
        const result = await this.query<{ figi: string }>(query);
        return result.rows.map(row => row.figi);
    }

    // Получение последних данных ETF
    async getLatestEtfData(figi?: string): Promise<Array<{ figi: string; data: FullEtfInfo; captured_at: Date }>> {
        let query = `
            SELECT DISTINCT ON (figi) figi, data, captured_at
            FROM etf_snapshot
        `;
        const params: any[] = [];

        if (figi) {
            query += ' WHERE figi = $1';
            params.push(figi);
        }

        query += ' ORDER BY figi, captured_at DESC';

        const result = await this.query<{ figi: string; data: FullEtfInfo; captured_at: Date }>(query, params);
        return result.rows;
    }

    // Получение последних данных об инвесторах
    async getLatestInvestorsData(figi?: string): Promise<Array<{ figi: string; investors: number; captured_at: Date }>> {
        let query = `
            SELECT DISTINCT ON (figi) figi, investors, captured_at
            FROM investors_snapshot
        `;
        const params: any[] = [];

        if (figi) {
            query += ' WHERE figi = $1';
            params.push(figi);
        }

        query += ' ORDER BY figi, captured_at DESC';

        const result = await this.query<{ figi: string; investors: number; captured_at: Date }>(query, params);
        return result.rows;
    }
}

// Экспортируем singleton экземпляр
export const db = new DatabaseClient();
