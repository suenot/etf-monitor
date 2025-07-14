declare class DemoBalancer {
    constructor();
    calculateDesiredPortfolio(): {
        portfolio: {};
        totalMarketCap: number;
    };
    analyzeMarketTiming(): {
        quietestHour: number;
        currentHour: number;
        isGoodTime: boolean;
        minVolatility: number;
    };
    calculateRebalanceOperations(currentPortfolio: any, desiredPortfolio: any): any[];
    demonstrateBalancing(): Promise<{
        success: boolean;
        operations: number;
        timing: string;
        portfolioValue: any;
    }>;
}
declare function runDemo(): Promise<void>;
export { DemoBalancer, runDemo };
//# sourceMappingURL=demo-balancer.d.ts.map