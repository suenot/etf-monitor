import 'dotenv/config';
declare class EtfMonitor {
    private etfFetchInterval;
    private investorsFetchInterval;
    private isRunning;
    private jobs;
    constructor();
    start(): Promise<void>;
    private setupScheduler;
    stop(): Promise<void>;
    getStatus(): {
        isRunning: boolean;
        etfFetchInterval: string;
        investorsFetchInterval: string;
        activeJobs: number;
    };
}
declare const monitor: EtfMonitor;
export { monitor, EtfMonitor };
//# sourceMappingURL=index.d.ts.map