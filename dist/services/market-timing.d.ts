declare class MarketTimingService {
    private volatilityHistory;
    private lastAnalysis;
    constructor();
    getHistoricalData(figi: string, days?: number): Promise<import("tinkoff-invest-api/dist/generated/marketdata.js").HistoricCandle[]>;
    convertTinkoffNumberToNumber(tinkoffNumber: any): any;
    calculateHourlyVolatility(candles: any[]): any[];
    analyzeMarketVolatility(tickers: string): Promise<any>;
    findQuietestTradingTime(tickers: string): Promise<{
        quietestHour: any;
        minVolatility: number;
        isQuietTime: boolean;
        currentHour: number;
        recommendation: {
            action: string;
            reason: string;
            nextCheckIn: number;
            confidence?: undefined;
            hoursUntilQuiet?: undefined;
        } | {
            action: string;
            reason: string;
            confidence: string;
            nextCheckIn?: undefined;
            hoursUntilQuiet?: undefined;
        } | {
            action: string;
            reason: string;
            nextCheckIn: number;
            hoursUntilQuiet: any;
            confidence?: undefined;
        };
    }>;
    getTimeRecommendation(quietestHour: any, minVolatility: any, isQuietTime: any): {
        action: string;
        reason: string;
        nextCheckIn: number;
        confidence?: undefined;
        hoursUntilQuiet?: undefined;
    } | {
        action: string;
        reason: string;
        confidence: string;
        nextCheckIn?: undefined;
        hoursUntilQuiet?: undefined;
    } | {
        action: string;
        reason: string;
        nextCheckIn: number;
        hoursUntilQuiet: any;
        confidence?: undefined;
    };
    isGoodTimeToTrade(tickers: string): Promise<boolean>;
    getVolatilityStats(): {
        minVolatility: number;
        maxVolatility: number;
        avgVolatility: number;
        hourlyData: any;
    };
}
export declare const marketTiming: MarketTimingService;
export default marketTiming;
//# sourceMappingURL=market-timing.d.ts.map