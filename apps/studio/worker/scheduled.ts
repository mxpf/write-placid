import { runScheduledReconciliation as runCoreScheduledReconciliation } from "@mxpf/write-placid-core/studio/scheduler";

type ScheduledResult = { imported: number; published: number; unpublished: number };
export function runScheduledReconciliation(
  controller: Pick<ScheduledController, "cron" | "scheduledTime">,
  env: Pick<Cloudflare.Env, "DB" | "WRITE_PLACID_MIGRATION_MODE" | "WRITE_PLACID_AUTO_PUBLISH">,
  reconcile: () => Promise<ScheduledResult>,
) {
  return runCoreScheduledReconciliation(controller, {
    migrationMode: env.WRITE_PLACID_MIGRATION_MODE,
    record: (key, value) => env.DB.prepare("INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run(),
  }, reconcile);
}
