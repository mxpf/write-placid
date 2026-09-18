import assert from "node:assert/strict";
import test from "node:test";
import { createSaveQueue } from "../app/save-queue.ts";
import { normalizeIncomingDocument } from "../app/content.ts";
import { acknowledgeSave, planSave, validateSaveRevision, withEditBase } from "../app/save-state.ts";
import { rememberEdits, recoverEdits, lastRecoveredDocument } from "../app/editor-recovery.ts";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise(resolve => setImmediate(resolve));
const piece = () => withEditBase(normalizeIncomingDocument({ title: "Queue fixture", body: "Before edits." }));
const storage = () => {
  const records = new Map();
  return { getItem: k => records.get(k) ?? null, setItem: (k, v) => records.set(k, v), removeItem: k => records.delete(k) };
};

test("Update waits for edits queued during autosave and receives the final acknowledged baseline", async () => {
  let current = { ...piece(), body: "First edit." };
  let savedBody = "Before edits.";
  const requests = [];
  const save = createSaveQueue({
    current: () => current,
    needsSave: value => value.body !== savedBody,
    save: value => { const request = { value, ...deferred() }; requests.push(request); return request.promise; },
    acknowledge: (sent, saved) => { current = acknowledgeSave(current, sent, saved); savedBody = saved.body; },
    failed: error => { throw error; },
  });
  const autosave = save();
  await settle();
  current = { ...current, body: "First edit plus a new caption." };
  const update = save();
  assert.equal(update, autosave);
  let updateReady = false;
  void update.then(() => { updateReady = true; });
  requests[0].resolve(withEditBase({ ...requests[0].value, kdriveEtag: "first-saved" }));
  await settle();
  assert.equal(requests.length, 2);
  assert.equal(updateReady, false);
  assert.equal(requests[1].value.body, current.body);
  assert.equal(requests[1].value.kdriveEtag, "first-saved");
  const final = withEditBase({ ...requests[1].value, kdriveEtag: "second-saved" });
  requests[1].resolve(final);
  const publishedInput = await update;
  assert.equal(publishedInput.body, final.body);
  assert.equal(publishedInput.editBase, final.editBase);
  assert.equal(validateSaveRevision(publishedInput, final), null);
});

test("a failed save blocks every waiting caller, retains edits, and permits a later explicit retry", async () => {
  const current = { ...piece(), body: "Must survive failure." };
  let acknowledged = false;
  const requests = [], errors = [];
  const save = createSaveQueue({
    current: () => current,
    needsSave: () => !acknowledged,
    save: value => { const request = { value, ...deferred() }; requests.push(request); return request.promise; },
    acknowledge: () => { acknowledged = true; },
    failed: error => errors.push(error.message),
  });
  const first = save(), update = save();
  await settle();
  requests[0].reject(new Error("Connection failed after sending"));
  assert.equal(await first, null);
  assert.equal(await update, null);
  assert.equal(current.body, "Must survive failure.");
  assert.equal(requests.length, 1);
  const retry = save();
  await settle();
  requests[1].resolve(current);
  assert.equal(await retry, current);
  assert.deepEqual(errors, ["Connection failed after sending"]);
});

test("reloading an already committed recovered edit discards its stale conflict baseline", () => {
  const browser = storage();
  const original = piece();
  const sent = { ...original, body: '![Image](/images/test.jpg "Saved caption")' };
  rememberEdits(browser, sent);
  assert.equal(lastRecoveredDocument(browser).body, sent.body);
  const canonical = withEditBase({ ...sent, kdriveEtag: "committed" });
  assert.equal(recoverEdits(browser, canonical), null);
  assert.equal(lastRecoveredDocument(browser), null);
  assert.equal(validateSaveRevision({ ...canonical, body: '![Image](/images/test.jpg "Next caption")' }, canonical), null);
});

test("a retry can acknowledge identical writing without overwriting a genuinely different caption", () => {
  const original = piece();
  const sent = { ...original, body: '![Image](/images/test.jpg "Saved caption")' };
  const canonical = withEditBase({ ...sent, kdriveEtag: "committed" });
  assert.equal(planSave(sent, canonical).alreadySaved, true);
  assert.equal(planSave(sent, canonical).error, null);
  const different = { ...sent, body: '![Image](/images/test.jpg "Unconfirmed next caption")' };
  assert.equal(planSave(different, canonical).alreadySaved, false);
  assert.match(planSave(different, canonical).error, /different writing/);
  const browser = storage();
  rememberEdits(browser, different);
  const recovered = recoverEdits(browser, canonical);
  assert.equal(recovered.body, different.body);
  assert.equal(recovered.editBase, original.editBase);
  assert.match(validateSaveRevision(recovered, canonical), /different writing/);
});
