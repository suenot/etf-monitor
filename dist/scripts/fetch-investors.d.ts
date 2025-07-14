import 'dotenv/config';
declare function fetchInvestorsData(): Promise<{
    success: boolean;
    error: string;
    processed?: undefined;
    received?: undefined;
    saved?: undefined;
    errors?: undefined;
    duration?: undefined;
} | {
    success: boolean;
    processed: number;
    received: number;
    saved: number;
    errors: number;
    duration: number;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    duration: number;
    processed?: undefined;
    received?: undefined;
    saved?: undefined;
    errors?: undefined;
}>;
declare function getInvestorsStats(): Promise<any>;
export { fetchInvestorsData, getInvestorsStats };
//# sourceMappingURL=fetch-investors.d.ts.map