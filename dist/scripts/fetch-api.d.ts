import 'dotenv/config';
declare function fetchEtfData(): Promise<{
    success: boolean;
    processed: number;
    saved: number;
    errors: number;
    capturedAt: Date;
    duration: number;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    duration: number;
    processed?: undefined;
    saved?: undefined;
    errors?: undefined;
    capturedAt?: undefined;
}>;
declare function getEtfStats(): Promise<any>;
export { fetchEtfData, getEtfStats };
//# sourceMappingURL=fetch-api.d.ts.map