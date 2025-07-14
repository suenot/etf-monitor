declare class Analytics {
    getEtfSummary(): Promise<any>;
    getTopEtfsByInvestors(limit?: number): Promise<any[]>;
    getInvestorsGrowth(figi: string, days?: number): Promise<any[]>;
    getCurrencyDistribution(): Promise<any[]>;
    getFastestGrowingEtfs(days?: number, limit?: number): Promise<any[]>;
    getEtfDetailedReport(figi: string): Promise<{
        figi: string;
        etfData: any;
        investorsStats: any;
        recentInvestors: any[];
    }>;
    getSystemStats(): Promise<{
        etf: any;
        investors: any;
    }>;
}
export declare const analytics: Analytics;
export {};
//# sourceMappingURL=analytics.d.ts.map