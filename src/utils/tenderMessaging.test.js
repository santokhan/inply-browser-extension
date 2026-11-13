import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { openMyTenders, searchMyTender } from "./tenderMessaging.js";
import { tenderPageAction } from "../content/tender.js";

afterEach(() => {
  for (const key of ["chrome", "window", "document"]) delete globalThis[key];
});

test("opening My Tenders installs its receiver when an existing tab has none", async () => {
  let sends = 0;
  const injections = [];
  globalThis.chrome = {
    tabs: { sendMessage: async () => {
      if (++sends === 1) throw new Error("Could not establish connection. Receiving end does not exist.");
      return { ok: true };
    } },
    scripting: { executeScript: async (options) => { injections.push(options); } },
  };
  assert.deepEqual(await openMyTenders(12), { ok: true });
  assert.equal(sends, 2);
  assert.deepEqual(injections, [{ target: { tabId: 12, frameIds: [0] }, func: tenderPageAction, args: ["install"] }]);
});

test("the injected receiver runs without module scope and installs once", () => {
  const install = (0, eval)(`(${tenderPageAction.toString()})`);
  const listeners = [];
  let clicks = 0;
  globalThis.window = { location: { origin: "https://www.eprocure.gov.bd" } };
  globalThis.document = { querySelector: () => ({ click: () => { clicks++; } }) };
  globalThis.chrome = { runtime: { onMessage: { addListener: (listener) => listeners.push(listener) } } };
  install("install");
  install("install");
  assert.equal(listeners.length, 1);
  let result;
  listeners[0]({ action: "openTenders", expectedOrigin: window.location.origin }, {}, (reply) => { result = reply; });
  assert.equal(result.ok, true);
  assert.equal(clicks, 1);
});

test("a reply reporting a missing link is returned without installing or clicking again", async () => {
  const result = { ok: false, message: "My Tenders link not found on this page." };
  globalThis.chrome = {
    tabs: { sendMessage: async () => result },
    scripting: { executeScript: async () => assert.fail("A connected tab needs no injection") },
  };
  assert.equal(await openMyTenders(12), result);
});

test("search waits for navigation and controls, then sends the selected tender ID", async () => {
  let loads = 0;
  const messages = [];
  globalThis.chrome = {
    tabs: {
      get: async () => ({ status: ++loads === 1 ? "loading" : "complete" }),
      sendMessage: async (tabId, message) => {
        assert.equal(tabId, 12);
        messages.push(message);
        if (messages.length === 1) return { ok: false, retryable: true };
        return { ok: true, message: "Search started." };
      },
    },
  };
  assert.equal((await searchMyTender(12, "001234")).ok, true);
  assert.equal(loads, 3);
  assert.equal(messages.length, 2);
  assert.equal(messages[1].action, "searchTender");
  assert.equal(messages[1].tenderId, "1234");
});
