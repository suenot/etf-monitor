import 'dotenv/config';
import { TinkoffInvestApi } from 'tinkoff-invest-api';
import type { EtfBasic, EtfDetailed, AssetInfo, FullEtfInfo } from '../types/index.js';
declare class TinkoffApiService {
    private api;
    private token;
    constructor();
    connect(): Promise<TinkoffInvestApi>;
    disconnect(): Promise<void>;
    getEtfs(): Promise<EtfBasic[]>;
    getEtfByFigi(figi: string): Promise<EtfDetailed>;
    getAssetByUid(assetUid: string): Promise<AssetInfo>;
    getFullEtfInfo(etf: EtfBasic): Promise<FullEtfInfo>;
    getAllEtfsWithDetails(): Promise<FullEtfInfo[]>;
}
export declare const tinkoffApi: TinkoffApiService;
export {};
//# sourceMappingURL=tinkoff-api.d.ts.map