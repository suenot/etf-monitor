declare class BalancerService {
    private isRunning;
    private lastBalance;
    private balanceHistory;
    private accountId;
    constructor();
    initialize(): Promise<boolean>;
    getAccountId(): Promise<string>;
    convertTinkoffNumberToNumber(tinkoffNumber: any): any;
    getInstrumentInfo(figi: string): Promise<import("tinkoff-invest-api/dist/generated/instruments.js").Instrument>;
    getCurrentPortfolio(): Promise<{
        positions: any[];
        totalValue: number;
        currency: string;
    }>;
    calculateRebalanceOperations(currentPortfolio: any, desiredPortfolio: any): any[];
    executeOperation(operation: any): Promise<{
        success: boolean;
        dryRun: boolean;
        operation?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        operation: any;
        dryRun?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        dryRun?: undefined;
        operation?: undefined;
    }>;
    rebalance(): Promise<{
        timestamp: Date;
        currentPortfolio: {
            positions: any[];
            totalValue: number;
            currency: string;
        };
        desiredPortfolio: {
            portfolio: {};
            marketCaps: Map<any, any>;
            totalMarketCap: number;
            calculatedAt: Date;
        };
        operations: any[];
        results: any[];
        success: boolean;
        totalOperations: number;
        successfulOperations: number;
    } | {
        success: boolean;
        reason: string;
        currentPortfolio?: undefined;
        desiredPortfolio?: undefined;
        error?: undefined;
        timestamp?: undefined;
    } | {
        success: boolean;
        reason: string;
        currentPortfolio: {
            positions: any[];
            totalValue: number;
            currency: string;
        };
        desiredPortfolio: {
            portfolio: {};
            marketCaps: Map<any, any>;
            totalMarketCap: number;
            calculatedAt: Date;
        };
        error?: undefined;
        timestamp?: undefined;
    } | {
        success: boolean;
        error: any;
        timestamp: Date;
        reason?: undefined;
        currentPortfolio?: undefined;
        desiredPortfolio?: undefined;
    }>;
    startAutoRebalancing(): Promise<void>;
    getStats(): {
        isRunning: boolean;
        lastBalance: any;
        totalBalances: number;
        successRate: number;
        accountId: string;
        config: {
            interval: number;
            etfsCount: number;
            dryRun: boolean;
        };
    };
    stop(): void;
}
export declare const balancer: BalancerService;
export default balancer;
//# sourceMappingURL=balancer.d.ts.map