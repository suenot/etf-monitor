export interface TinkoffNumber {
    currency?: string;
    units: number;
    nano: number;
}
export interface MoneyValue {
    currency: string;
    units: number;
    nano: number;
}
export interface Quotation {
    units: number;
    nano: number;
}
export interface EtfBasic {
    figi: string;
    ticker: string;
    classCode: string;
    isin: string;
    lot: number;
    currency: string;
    name: string;
    exchange: string;
    countryOfRisk: string;
    countryOfRiskName: string;
    sector: string;
    issueSize: number;
    nominal: MoneyValue;
    tradingStatus: string;
    otcFlag: boolean;
    buyAvailableFlag: boolean;
    sellAvailableFlag: boolean;
    minPriceIncrement: Quotation;
    apiTradeAvailableFlag: boolean;
    uid: string;
    realExchange: string;
    positionUid: string;
    assetUid?: string;
    instrumentType: string;
}
export interface EtfDetailed extends EtfBasic {
    description: string;
    primaryIndex: string;
    focusType: string;
    leveragedFlag: boolean;
    numShares: Quotation;
    managementCompany: string;
    performanceFee: Quotation;
    fixedCommission: Quotation;
    paymentType: string;
    watermarkFlag: boolean;
    buyPremium: Quotation;
    sellDiscount: Quotation;
    rebalancingFlag: boolean;
    rebalancingFreq: string;
    rebalancingDate: string;
    rebalancingPlan: string;
    expenseCommission: Quotation;
}
export interface AssetInfo {
    uid: string;
    type: string;
    name: string;
    nameBrief: string;
    description: string;
    deletedAt?: string;
    requiredTests: string[];
    currency: string;
    security: {
        isin: string;
        type: string;
        share?: {
            primaryIndex: string;
            dividendRate: Quotation;
        };
        bond?: {
            nominal: MoneyValue;
            nominalCurrency: string;
        };
    };
    gosRegCode: string;
    cfi: string;
    codeNsd: string;
    status: string;
    brand: {
        uid: string;
        name: string;
        description: string;
        info: string;
        company: string;
        sector: string;
        countryOfRisk: string;
        countryOfRiskName: string;
    };
    updatedAt: string;
    brCode: string;
    brCodeName: string;
    instruments: Array<{
        uid: string;
        figi: string;
        instrumentType: string;
        ticker: string;
        classCode: string;
        links: Array<{
            type: string;
            instrumentUid: string;
        }>;
    }>;
}
export interface FullEtfInfo {
    basic: EtfBasic;
    detailed: EtfDetailed;
    asset: AssetInfo | null;
    lastPrice?: TinkoffNumber;
}
export interface EtfSnapshot {
    id: number;
    figi: string;
    data: FullEtfInfo;
    captured_at: Date;
    created_at: Date;
}
export interface InvestorsSnapshot {
    id: number;
    figi: string;
    investors: number;
    captured_at: Date;
    created_at: Date;
}
export interface Position {
    figi: string;
    ticker: string;
    quantity: number;
    averagePrice: TinkoffNumber;
    currentPrice: TinkoffNumber;
    totalValue: TinkoffNumber;
    expectedYield: TinkoffNumber;
    instrumentType: string;
}
export interface Portfolio {
    totalAmountShares: MoneyValue;
    totalAmountBonds: MoneyValue;
    totalAmountEtf: MoneyValue;
    totalAmountCurrencies: MoneyValue;
    totalAmountFutures: MoneyValue;
    expectedYield: Quotation;
    positions: Position[];
}
export interface DesiredPortfolio {
    [ticker: string]: number;
}
export interface BalanceOperation {
    action: 'buy' | 'sell';
    ticker: string;
    figi: string;
    quantity: number;
    price: TinkoffNumber;
    totalValue: number;
    valueDiff: number;
}
export interface BalanceResult {
    timestamp: Date;
    currentPortfolio: Portfolio;
    desiredPortfolio: DesiredPortfolio;
    operations: BalanceOperation[];
    results: Array<{
        success: boolean;
        operation?: BalanceOperation;
        error?: string;
        dryRun?: boolean;
    }>;
    success: boolean;
    totalOperations: number;
    successfulOperations: number;
}
export interface CandleData {
    open: Quotation;
    high: Quotation;
    low: Quotation;
    close: Quotation;
    volume: number;
    time: Date;
    isComplete: boolean;
}
export interface VolatilityData {
    hour: number;
    averageVolatility: number;
    sampleSize: number;
}
export interface MarketTimingRecommendation {
    action: 'trade' | 'wait';
    reason: string;
    nextCheckIn?: number;
    hoursUntilQuiet?: number;
}
export interface MarketTimingAnalysis {
    currentHour: number;
    quietestHour: number;
    currentVolatility: number;
    averageVolatility: number;
    recommendation: MarketTimingRecommendation;
    volatilityByHour: VolatilityData[];
}
export interface EtfAnalytics {
    figi: string;
    ticker: string;
    name: string;
    totalSnapshots: number;
    firstSnapshot: Date;
    lastSnapshot: Date;
    averageInvestors?: number;
    investorsGrowth?: number;
    priceChange?: number;
    volatility?: number;
}
export interface InvestorsGrowthData {
    date: Date;
    investors: number;
    change: number;
    changePercent: number;
}
export interface BalancerConfig {
    BALANCE_INTERVAL: number;
    SLEEP_BETWEEN_ORDERS: number;
    TINKOFF_ETFS: string[];
    QUIET_HOURS: {
        ENABLED: boolean;
        VOLATILITY_THRESHOLD: number;
        MOVING_AVERAGE_DAYS: number;
        MIN_SAMPLE_SIZE: number;
        ANALYSIS_HOURS?: number[];
    };
    SAFETY: {
        DRY_RUN: boolean;
        MAX_SINGLE_OPERATION_PERCENT: number;
        MIN_OPERATION_VALUE: number;
        MAX_DAILY_OPERATIONS: number;
    };
    ACCOUNT_ID?: string;
    MIN_ORDER_VALUE?: number;
    MAX_DEVIATION_PERCENT?: number;
}
export interface HealthCheckResult {
    service: string;
    status: 'healthy' | 'unhealthy' | 'warning';
    message: string;
    details?: any;
    timestamp: Date;
}
export interface SystemHealth {
    overall: 'healthy' | 'unhealthy' | 'warning';
    checks: HealthCheckResult[];
    timestamp: Date;
}
export interface ScrapedInvestorData {
    figi: string;
    ticker: string;
    investors: number;
    scrapedAt: Date;
}
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: any;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: Date;
}
export interface DatabaseConfig {
    connectionString: string;
    ssl?: boolean;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}
export interface QueryResult<T = any> {
    rows: T[];
    rowCount: number;
    command: string;
}
//# sourceMappingURL=index.d.ts.map