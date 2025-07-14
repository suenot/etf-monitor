// logger.js - Утилита для логирования
import 'dotenv/config';

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        
        if (data) {
            return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
        }
        return `${prefix} ${message}`;
    }

    error(message, data = null) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, data));
        }
    }

    warn(message, data = null) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }

    info(message, data = null) {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, data));
        }
    }

    debug(message, data = null) {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, data));
        }
    }

    // Специальные методы для ETF мониторинга
    etfFetch(message, data = null) {
        this.info(`[ETF-FETCH] ${message}`, data);
    }

    investorsFetch(message, data = null) {
        this.info(`[INVESTORS-FETCH] ${message}`, data);
    }

    scheduler(message, data = null) {
        this.info(`[SCHEDULER] ${message}`, data);
    }

    database(message, data = null) {
        this.debug(`[DATABASE] ${message}`, data);
    }

    api(message, data = null) {
        this.debug(`[API] ${message}`, data);
    }

    scraper(message, data = null) {
        this.debug(`[SCRAPER] ${message}`, data);
    }
}

// Экспортируем singleton экземпляр
export const logger = new Logger();
