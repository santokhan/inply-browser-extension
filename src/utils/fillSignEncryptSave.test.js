import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { runFillSignEncryptSave } from "./fillSignEncryptSave.js";

afterEach(() => { delete globalThis.chrome; });

test("missing password stops before filling or sending page actions", async () => {
  globalThis.chrome = { storage: { local: { get: async () => ({}) } } };
  const result = await runFillSignEncryptSave(12, {
    beforeRun: () => assert.fail("Cannot fill without the saved password"),
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /save a password/);
});

test("failed fill stops before signing", async () => {
  globalThis.chrome = { storage: { local: { get: async () => ({ encryptPassword: "test" }) } } };
  const result = await runFillSignEncryptSave(12, {
    beforeRun: async () => ({ ok: false, message: "Fields do not match" }),
  });
  assert.deepEqual(result, { ok: false, message: "Fields do not match" });
});

test("unverified signature stops before encryption and save", async () => {
  const actions = [];
  globalThis.chrome = {
    storage: { local: { get: async () => ({ encryptPassword: "test" }) } },
    tabs: { sendMessage: async (tabId, message) => {
      assert.equal(tabId, 12);
      actions.push(message.action);
      return { ok: true, verified: false };
    } },
  };
  const result = await runFillSignEncryptSave(12, { beforeRun: async () => ({ ok: true }) });
  assert.equal(result.ok, false);
  assert.deepEqual(actions, ["signAndVerify"]);
});

test("Apply fills without requiring a password or signing", async () => {
  let filled = false;
  assert.deepEqual(await runFillSignEncryptSave(12, {
    applyOnly: true,
    beforeRun: async () => { filled = true; return { ok: true }; },
  }), { ok: true });
  assert.equal(filled, true);
});

test("a closed signing channel reports its stage instead of restarting tender navigation", async () => {
  globalThis.chrome = {
    storage: { local: { get: async () => ({ encryptPassword: "test" }) } },
    tabs: { sendMessage: async () => { throw new Error("message port closed"); } },
  };
  assert.deepEqual(await runFillSignEncryptSave(12), {
    ok: false, stage: "signAndVerify", message: "Sign failed: message port closed",
  });
});
