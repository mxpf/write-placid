export type ScheduledResult = {
    imported: number;
    published: number;
    unpublished: number;
};
export type ScheduledRecorder = (key: string, value: string) => Promise<unknown>;
/** Reconciliation scheduling with an injected durable recorder. */
export declare function runScheduledReconciliation(controller: {
    cron: string;
    scheduledTime: number;
}, options: {
    migrationMode?: string | number;
    record: ScheduledRecorder;
    logger?: Pick<Console, "log" | "warn">;
}, reconcile: () => Promise<ScheduledResult>): Promise<ScheduledResult | undefined>;
//# sourceMappingURL=scheduled.d.ts.map