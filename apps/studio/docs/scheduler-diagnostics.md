# Scheduled publishing investigation — September 17, 2026

## Resolved verification

A real production event was received at `2026-09-17T04:25:46Z` on diagnostic version `105a9f8d-9cfb-422f-999b-d2725ba40a1f` and completed at `04:25:50.972Z`. Cloudflare tail reported `outcome: ok` and no exceptions. The durable D1 record confirms 28 imported, 14 published, and 0 unpublished. A full cache comparison verified all 28 canonical bodies, identities, slugs, dates, statuses, filenames, and provenance. Corrigible remained a draft. The public branch stayed at `2aecedde3cb0ed71d102d1a119f00cce41156095`, so reconciliation introduced no public content or asset changes.

The hosted scheduled image/publication/cache workflow is verified for this migrated snapshot. There is no current scheduler blocker. The exact cause of the earlier gap remains unknown; do not attribute restored delivery to the diagnostic code without additional evidence. The execution recorder now provides direct evidence for future investigations.

## Verified state

The editorial migration and public snapshot are preserved. KDrive and D1 contain 28 canonical documents: 14 published and 14 drafts. Corrigible remains a draft. Public snapshot commit `2aecedde3cb0ed71d102d1a119f00cce41156095` built and deployed successfully. This investigation does not change article content, identity, URLs, or draft status.

Cloudflare account: `389fb319f0ec9f74e43ca648150da9b3`.
Worker/service: use the configured Write Placid Studio Worker name.
Environment: `production`.
Script tag: `ff59038adc8044b696f18b2b471662d7`.
Schedule: `*/5 * * * *`.

The latest diagnostic Worker version is `105a9f8d-9cfb-422f-999b-d2725ba40a1f`. Its publishing contract is enabled, migration maintenance is disabled, and its deployed module exports both `fetch` and `scheduled` handlers.

## Evidence and interpretation

The cron-specific GraphQL dataset `workersInvocationsScheduled` confirms successful production runs before maintenance. The last returned event was scheduled at `2026-09-17T03:20:41Z`, completed at `03:20:46Z`, and reported success; maintenance was active then. The preceding regular runs used the same script and production environment.

The schedule was restored at `03:51:36Z`. Cloudflare's schedule API confirms that it exists, and deployment metadata confirms the scheduled handler. A single trigger refresh at approximately `04:13:16Z` also succeeded. No repeated refresh is warranted without new evidence.

Two live log streams, the general invocation dataset, the cron-specific dataset, and unchanged D1 publication baselines did not establish any subsequent hosted reconciliation during the original observation window. Empty logs alone do not prove that a trigger was not delivered. The combination establishes that successful scheduled publication has not been verified; the provider's delivery or reporting failure has not been isolated to a specific root cause.

## Operational recording added

`worker/scheduled.ts` now writes a structured console entry and a private D1 `sync_state` record with key `editorial-scheduled-run`. It records `started`, `completed`, `failed`, or `skipped`. Completion is recorded only after the complete existing reconciliation returns, including image publication and cache updates. Failure remains a rejected scheduled invocation. A failure to store the operational record is logged and does not prevent reconciliation. The maintenance check uses the invocation's environment binding.

Type checking, lint, build, and 49 tests passed. The tests include recording completion after reconciliation, preserving failures, honoring maintenance, continuing if operational recording fails, and routing a scheduled event through the actual built Worker. These are local checks, not proof of a hosted invocation.

Read the durable production record with:

```sh
npx wrangler d1 execute YOUR_DATABASE_NAME --remote --config wrangler.cloudflare.jsonc --command "SELECT key,value FROM sync_state WHERE key='editorial-scheduled-run'" --json
```

A `completed` record is positive evidence of the hosted workflow. Verify its document counts and public commit before closing this issue. A `started` record without completion needs investigation of the matching invocation logs; a `failed` record provides the actual application error. A missing record together with missing cron events warrants provider investigation rather than further editorial changes.

## Escalation if missing executions recur

If future schedule windows stop producing execution records and cron events, provide Cloudflare Support with the identifiers and timestamps above and the following question:

> Why did production scheduled invocations stop after maintenance even though the restored cron trigger exists and the active Worker exports a scheduled handler? Please inspect scheduler registration and event delivery for this script tag, and distinguish absent delivery from missing telemetry. The old trigger ran successfully before maintenance. Please do not change the Worker, its secrets, D1 content, or the schedule without coordinating the change.

The private evidence directory `work/rollout-2026-09-17/` contains `schedule-verification.json`, `service.json`, `scheduled-events-diagnostic.json`, the deployment records, cache checks, `diagnostic-tail.jsonl`, and `scheduled-success-verification.json`. Share only sanitized operational records with support. Do not share the directory wholesale: it also contains unpublished writing and migration backups.
