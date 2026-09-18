export type ScheduledResult = { imported: number; published: number; unpublished: number };
export type ScheduledRecorder = (key: string, value: string) => Promise<unknown>;

/** Reconciliation scheduling with an injected durable recorder. */
export async function runScheduledReconciliation(
  controller: { cron: string; scheduledTime: number },
  options: { migrationMode?: string | number; record: ScheduledRecorder; logger?: Pick<Console, "log" | "warn"> },
  reconcile: () => Promise<ScheduledResult>,
) {
  const logger = options.logger || console;
  const startedAt = new Date().toISOString();
  const identity = { cron: controller.cron, scheduledAt: new Date(controller.scheduledTime).toISOString(), startedAt };
  async function record(phase: string, details: Record<string, unknown> = {}) {
    const entry = { ...identity, phase, recordedAt: new Date().toISOString(), ...details };
    logger.log("editorial-scheduled-run", JSON.stringify(entry));
    try { await options.record("editorial-scheduled-run", JSON.stringify(entry)); }
    catch (error) { logger.warn("Could not record scheduled execution", String(error)); }
  }
  if (String(options.migrationMode) === "1") { await record("skipped", { reason: "migration-maintenance" }); return; }
  await record("started");
  try { const result = await reconcile(); await record("completed", { result }); return result; }
  catch (error) { await record("failed", { error: String(error) }); throw error; }
}
