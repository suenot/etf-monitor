declare class PortfolioCalculatorService {
    private etfData;
    private lastUpdate;
    private updateInterval;
    constructor();
    getTinkoffEtfsData(): Promise<any[]>;
    getLastPrice(figi: string): Promise<any>;
    convertTinkoffNumberToNumber(tinkoffNumber: any): any;
    calculateMarketCap(etfData: any): number;
    calculateDesiredPortfolio(): Promise<{
        portfolio: {};
        marketCaps: Map<any, any>;
        totalMarketCap: number;
        calculatedAt: Date;
    }>;
    getEtfInfo(ticker: string): any;
    getAvailableEtfs(): string[];
}
export declare const portfolioCalculator: PortfolioCalculatorService;
export default portfolioCalculator;
//# sourceMappingURL=portfolio-calculator.d.ts.map