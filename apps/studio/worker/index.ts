import handler from "vinext/server/app-router-entry";
import { runScheduledReconciliation } from "./scheduled";

export default {
  fetch: handler.fetch.bind(handler),
  scheduled(controller: ScheduledController, env: Cloudflare.Env, context: ExecutionContext) {
    context.waitUntil(
      runScheduledReconciliation(controller, env, async () => {
        const { syncKdriveRepository } = await import("../app/kdrive-sync");
        return syncKdriveRepository({ publish: String(env.WRITE_PLACID_AUTO_PUBLISH) === "1" });
      }),
    );
  },
};
