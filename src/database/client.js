// client.js - Клиент для работы с базой данных
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

class DatabaseClient {
    constructor() {
        this.client = null;
        this.connectionString = process.env.DATABASE_URL;
    }

    async connect() {
        if (!this.client) {
            this.client = new Client({
                connectionString: this.connectionString
            });
            await this.client.connect();
            console.log('Подключение к базе данных установлено');
        }
        return this.client;
    }

    async disconnect() {
        if (this.client) {
            await this.client.end();
            this.client = null;
            console.log('Соединение с базой данных закрыто');
        }
    }

    async query(text, params) {
        const client = await this.connect();
        return client.query(text, params);
    }

    // Сохранение снимка ETF
    async saveEtfSnapshot(figi, data, capturedAt = new Date()) {
        const query = `
            INSERT INTO etf_snapshot(figi, data, captured_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (figi, captured_at) DO NOTHING
            RETURNING id
        `;
        return this.query(query, [figi, JSON.stringify(data), capturedAt]);
    }

    // Сохранение данных об инвесторах
    async saveInvestorsSnapshot(figi, investors, capturedAt = new Date()) {
        const query = `
            INSERT INTO investors_snapshot(figi, investors, captured_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (figi, captured_at) DO NOTHING
            RETURNING id
        `;
        return this.query(query, [figi, investors, capturedAt]);
    }

    // Получение списка уникальных FIGI
    async getUniqueFigis() {
        const query = 'SELECT DISTINCT figi FROM etf_snapshot ORDER BY figi';
        const result = await this.query(query);
        return result.rows.map(row => row.figi);
    }

    // Получение последних данных ETF
    async getLatestEtfData(figi = null) {
        let query = `
            SELECT DISTINCT ON (figi) figi, data, captured_at
            FROM etf_snapshot
        `;
        let params = [];

        if (figi) {
            query += ' WHERE figi = $1';
            params.push(figi);
        }

        query += ' ORDER BY figi, captured_at DESC';

        const result = await this.query(query, params);
        return result.rows;
    }

    // Получение последних данных об инвесторах
    async getLatestInvestorsData(figi = null) {
        let query = `
            SELECT DISTINCT ON (figi) figi, investors, captured_at
            FROM investors_snapshot
        `;
        let params = [];

        if (figi) {
            query += ' WHERE figi = $1';
            params.push(figi);
        }

        query += ' ORDER BY figi, captured_at DESC';

        const result = await this.query(query, params);
        return result.rows;
    }
}

// Экспортируем singleton экземпляр
export const db = new DatabaseClient();
