type ScheduledResult = { imported: number; published: number; unpublished: number };

/** Operational evidence only; recording failures must not interrupt publishing. */
export async function runScheduledReconciliation(
  controller: Pick<ScheduledController, "cron" | "scheduledTime">,
  env: Pick<Cloudflare.Env, "DB" | "WRITE_PLACID_MIGRATION_MODE" | "WRITE_PLACID_AUTO_PUBLISH">,
  reconcile: () => Promise<ScheduledResult>,
) {
  const startedAt = new Date().toISOString();
  const identity = { cron: controller.cron, scheduledAt: new Date(controller.scheduledTime).toISOString(), startedAt };
  async function record(phase: string, details: Record<string, unknown> = {}) {
    const entry = { ...identity, phase, recordedAt: new Date().toISOString(), ...details };
    console.log("editorial-scheduled-run", JSON.stringify(entry));
    try {
      await env.DB.prepare("INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind("editorial-scheduled-run", JSON.stringify(entry)).run();
    } catch (error) {
      console.warn("Could not record scheduled execution", String(error));
    }
  }
  if (String(env.WRITE_PLACID_MIGRATION_MODE) === "1") {
    await record("skipped", { reason: "migration-maintenance" });
    return;
  }
  await record("started");
  try {
    const result = await reconcile();
    await record("completed", { result });
    return result;
  } catch (error) {
    await record("failed", { error: String(error) });
    throw error;
  }
}
