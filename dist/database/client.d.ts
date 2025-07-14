import 'dotenv/config';
import pg from 'pg';
import type { FullEtfInfo, QueryResult } from '../types/index.js';
declare class DatabaseClient {
    private client;
    private connectionString;
    constructor();
    connect(): Promise<pg.Client>;
    disconnect(): Promise<void>;
    query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
    saveEtfSnapshot(figi: string, data: FullEtfInfo, capturedAt?: Date): Promise<QueryResult<{
        id: number;
    }>>;
    saveInvestorsSnapshot(figi: string, investors: number, capturedAt?: Date): Promise<QueryResult<{
        id: number;
    }>>;
    getUniqueFigis(): Promise<string[]>;
    getLatestEtfData(figi?: string): Promise<Array<{
        figi: string;
        data: FullEtfInfo;
        captured_at: Date;
    }>>;
    getLatestInvestorsData(figi?: string): Promise<Array<{
        figi: string;
        investors: number;
        captured_at: Date;
    }>>;
}
export declare const db: DatabaseClient;
export {};
//# sourceMappingURL=client.d.ts.map