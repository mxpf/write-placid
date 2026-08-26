import handler from "vinext/server/app-router-entry";

export default {
  fetch: handler.fetch.bind(handler),
  scheduled(_controller: ScheduledController, _env: Cloudflare.Env, context: ExecutionContext) {
    context.waitUntil(
      import("../app/kdrive-sync").then(({ syncKdriveRepository }) =>
        syncKdriveRepository(),
      ),
    );
  },
};
