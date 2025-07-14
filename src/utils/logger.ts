import type { ApiResponse, FullEtfInfo, QueryResult, LogLevel } from '../types/index.js';
// logger.ts - Утилита для логирования
import 'dotenv/config';

class Logger {
    private logLevel: LogLevel;
    private levels: Record<LogLevel, number>;

    constructor() {
        this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    shouldLog(level: LogLevel): boolean {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level: LogLevel, message: string, data: any = null): string {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        if (data) {
            return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
        }
        return `${prefix} ${message}`;
    }

    error(message: string, data: any = null): void {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, data));
        }
    }

    warn(message: string, data: any = null): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }

    info(message: string, data: any = null): void {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, data));
        }
    }

    debug(message: string, data: any = null): void {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, data));
        }
    }

    // Специальные методы для ETF мониторинга
    etfFetch(message: string, data: any = null): void {
        this.info(`[ETF-FETCH] ${message}`, data);
    }

    investorsFetch(message: string, data: any = null): void {
        this.info(`[INVESTORS-FETCH] ${message}`, data);
    }

    scheduler(message: string, data: any = null): void {
        this.info(`[SCHEDULER] ${message}`, data);
    }

    database(message: string, data: any = null): void {
        this.debug(`[DATABASE] ${message}`, data);
    }

    api(message: string, data: any = null): void {
        this.debug(`[API] ${message}`, data);
    }

    scraper(message: string, data: any = null): void {
        this.debug(`[SCRAPER] ${message}`, data);
    }
}

// Экспортируем singleton экземпляр
export const logger = new Logger();
