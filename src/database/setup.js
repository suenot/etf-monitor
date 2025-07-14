// setup.js - Настройка базы данных
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Подключение к базе данных установлено');

        // Читаем SQL схему
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf8');

        // Выполняем создание таблиц
        await client.query(schema);
        console.log('Схема базы данных успешно создана');

        // Проверяем созданные таблицы
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('etf_snapshot', 'investors_snapshot')
        `);

        console.log('Созданные таблицы:', tablesResult.rows.map(row => row.table_name));

    } catch (error) {
        console.error('Ошибка при настройке базы данных:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Запуск настройки если файл вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    setupDatabase();
}

export { setupDatabase };
