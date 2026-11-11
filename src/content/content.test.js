import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";

test("main router lets the dedicated profile listener send its asynchronous reply", async () => {
  const listeners = [];
  const context = createContext({
    window: {},
    // Keep automatic encryption startup paused; this test only sends messages.
    setTimeout: () => {},
    handleCustomerProfileRequest: async () => ({ ok: true, profile: { businessName: "Customer company" } }),
    chrome: { runtime: {
      id: "extension-id",
      getURL: () => "chrome-extension://extension-id/",
      onMessage: { addListener: (listener) => listeners.push(listener) },
    } },
  });
  runInContext(await readFile(new URL("./content.js", import.meta.url), "utf8"), context);
  const entry = await readFile(new URL("./customerProfileEntry.js", import.meta.url), "utf8");
  runInContext(entry.replace(/^import .*;\r?\n/, ""), context);
  const responses = [];
  const sender = { id: "extension-id", url: "chrome-extension://extension-id/index.html" };
  for (const listener of listeners) {
    listener({ action: "readCustomerProfile" }, sender, (response) => responses.push(response));
  }
  await new Promise(setImmediate);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].ok, true);
  assert.equal(responses[0].profile.businessName, "Customer company");
  for (const action of ["openViewProfilePage", "openCompanyDetailsTaba", "readCustomerProfile"]) {
    assert.equal(listeners[0]({ action }, sender, () => assert.fail("Requests belong to their dedicated listener")), false);
  }
});
