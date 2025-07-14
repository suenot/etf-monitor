import 'dotenv/config';
declare class ScraperService {
    private browser;
    private page;
    private config;
    constructor();
    init(): Promise<void>;
    close(): Promise<void>;
    getInvestorsCount(figi: string): Promise<any>;
    getFundComposition(figi: string): Promise<any>;
    getAllInvestorsData(figis: string): Promise<any[]>;
    checkSiteAvailability(): Promise<any>;
}
export declare const scraper: ScraperService;
export {};
//# sourceMappingURL=scraper.d.ts.map