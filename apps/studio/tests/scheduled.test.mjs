import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runScheduledReconciliation } from "../worker/scheduled.ts";

function fixture(mode = "0", recordingFails = false) {
  const entries = [];
  const env = { WRITE_PLACID_MIGRATION_MODE: mode, DB: { prepare() { return { bind(key, value) { assert.equal(key, "editorial-scheduled-run"); return { async run() { if (recordingFails) throw new Error("Recording unavailable"); entries.push(JSON.parse(value)); } }; } }; } } };
  return { entries, env, controller: { cron: "*/5 * * * *", scheduledTime: Date.parse("2026-09-17T04:20:00Z") } };
}

test("scheduled completion is recorded only after the entire reconciliation finishes", async () => {
  const { entries, env, controller } = fixture();
  const result = { imported: 28, published: 14, unpublished: 0 };
  await runScheduledReconciliation(controller, env, async () => { assert.deepEqual(entries.map(e => e.phase), ["started"]); return result; });
  assert.deepEqual(entries.map(e => e.phase), ["started", "completed"]);
  assert.deepEqual(entries[1].result, result);
  assert.equal(entries[1].scheduledAt, "2026-09-17T04:20:00.000Z");
});

test("scheduled failures remain failures and maintenance never calls the publisher", async () => {
  const active = fixture();
  await assert.rejects(runScheduledReconciliation(active.controller, active.env, async () => { throw new Error("Publication failed"); }), /Publication failed/);
  assert.deepEqual(active.entries.map(e => e.phase), ["started", "failed"]);
  const paused = fixture("1");
  await runScheduledReconciliation(paused.controller, paused.env, async () => { assert.fail("maintenance called publisher"); });
  assert.equal(paused.entries[0].phase, "skipped");
});

test("failure to store operational evidence does not block reconciliation", async () => {
  const { env, controller } = fixture("0", true);
  let called = false;
  await runScheduledReconciliation(controller, env, async () => { called = true; return { imported: 28, published: 14, unpublished: 0 }; });
  assert.equal(called, true);
});

test("the built Worker includes the scheduled execution recorder", async () => {
  const [source, build] = await Promise.all([
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
  ]);
  assert.match(source, /scheduled\([^)]*\)[\s\S]*context\.waitUntil\([\s\S]*runScheduledReconciliation/);
  assert.match(build, /editorial-scheduled-run/);
  assert.match(build, /migration-maintenance/);
  assert.match(build, /WRITE_PLACID_AUTO_PUBLISH/);
});
