import type { LogLevel } from '../types/index.js';
import 'dotenv/config';
declare class Logger {
    private logLevel;
    private levels;
    constructor();
    shouldLog(level: LogLevel): boolean;
    formatMessage(level: LogLevel, message: string, data?: any): string;
    error(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    info(message: string, data?: any): void;
    debug(message: string, data?: any): void;
    etfFetch(message: string, data?: any): void;
    investorsFetch(message: string, data?: any): void;
    scheduler(message: string, data?: any): void;
    database(message: string, data?: any): void;
    api(message: string, data?: any): void;
    scraper(message: string, data?: any): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map