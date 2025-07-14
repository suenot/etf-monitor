import 'dotenv/config';
declare class HealthCheck {
    private checks;
    private results;
    constructor();
    checkDatabase(): Promise<{
        status: string;
        message: string;
        details: {
            currentTime: any;
            connected: boolean;
        };
        error?: undefined;
    } | {
        status: string;
        message: string;
        error: any;
        details?: undefined;
    }>;
    checkTinkoffApi(): Promise<{
        status: string;
        message: string;
        details: {
            etfsCount: number;
            connected: boolean;
        };
        error?: undefined;
    } | {
        status: string;
        message: string;
        error: any;
        details?: undefined;
    }>;
    checkTCapitalSite(): Promise<{
        status: string;
        message: string;
        details: {
            available: boolean;
        };
        error?: undefined;
    } | {
        status: string;
        message: string;
        error: any;
        details?: undefined;
    }>;
    checkDataFreshness(): Promise<{
        status: string;
        message: string;
        details: {
            etfLastUpdate: any;
            investorsLastUpdate: any;
            etfAgeMinutes: number;
            investorsAgeMinutes: number;
        };
        warnings: any[];
        error?: undefined;
    } | {
        status: string;
        message: string;
        error: any;
        details?: undefined;
        warnings?: undefined;
    }>;
    checkDataVolume(): Promise<{
        status: string;
        message: string;
        details: any;
        warnings: any[];
        error?: undefined;
    } | {
        status: string;
        message: string;
        error: any;
        details?: undefined;
        warnings?: undefined;
    }>;
    runAllChecks(): Promise<{
        overallStatus: string;
        timestamp: string;
        checks: {};
    }>;
    quickCheck(): Promise<boolean>;
}
export declare const healthCheck: HealthCheck;
export {};
//# sourceMappingURL=health-check.d.ts.map