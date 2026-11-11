import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { sendLtmMessage } from "./ltmMessaging.js";
import { installPageParser } from "./pageParser.js";
import { createContext, runInContext } from "node:vm";

afterEach(() => { delete globalThis.chrome; });

function browser({ missingHandler = false } = {}) {
  let connected = false;
  const injections = [];
  const messages = [];
  globalThis.chrome = {
    runtime: { getManifest: () => ({ content_scripts: [{ js: [
      "assets/content.js-abc.js", "assets/signEncryptSave.js-abc.js", "assets/parser.js-abc.js",
    ] }] }) },
    tabs: { sendMessage: async (tabId, message) => {
      messages.push({ tabId, message });
      if (connected) return { ok: true };
      if (missingHandler) return { ok: false, message: `No content-script handler is registered for action "${message.action}".` };
      throw new Error("Could not establish connection. Receiving end does not exist.");
    } },
    scripting: { executeScript: async (injection) => {
      injections.push(injection);
      if (injection.func === installPageParser) connected = true;
      return [];
    } },
  };
  return { injections, messages };
}

test("missing receiver installs a fresh router and parser, then retries the original edit", async () => {
  const { injections, messages } = browser();
  const message = { action: "setLtmFieldValue", value: "Edited" };
  assert.equal((await sendLtmMessage(10, message)).ok, true);
  assert.deepEqual(injections[0].args, [true]);
  assert.equal(injections[1].func, installPageParser);
  assert.ok(injections.every((injection) => !injection.files));
  assert.deepEqual(messages, [{ tabId: 10, message }, { tabId: 10, message }]);
});

test("an older listener missing the LTM handler gets its parser refreshed", async () => {
  const { injections } = browser({ missingHandler: true });
  assert.equal((await sendLtmMessage(11, { action: "highlightLtmField" })).ok, true);
  assert.deepEqual(injections[0].args, [false]);
});

test("simultaneous LTM messages share one connection recovery", async () => {
  const { injections } = browser();
  const results = await Promise.all([
    sendLtmMessage(12, { action: "highlightLtmField" }),
    sendLtmMessage(12, { action: "setLtmFieldValue", value: "New" }),
  ]);
  assert.ok(results.every((result) => result.ok));
  assert.equal(injections.length, 2);
});

test("working listeners need no injection; unrelated errors are preserved", async () => {
  const { injections } = browser();
  chrome.tabs.sendMessage = async () => ({ ok: false, message: "Wrong form" });
  assert.deepEqual(await sendLtmMessage(13, {}), { ok: false, message: "Wrong form" });
  chrome.tabs.sendMessage = async () => { throw new Error("Cannot access this page"); };
  await assert.rejects(sendLtmMessage(13, {}), /Cannot access this page/);
  assert.equal(injections.length, 0);
});

test("recovery executes serialized functions without manifest files or module scope", async () => {
  let listener;
  const context = createContext({
    window: {},
    document: { body: { innerText: "Different webpage" } },
    chrome: { runtime: { onMessage: { addListener: (handler) => { listener = handler; } } } },
  });
  globalThis.chrome = {
    tabs: { sendMessage: async (tabId, message) => {
      if (!listener) throw new Error("Receiving end does not exist");
      return new Promise((resolve) => listener(message, {}, resolve));
    } },
    scripting: { executeScript: async ({ func, args = [] }) => {
      context.injectionArgs = args;
      runInContext(`(${func.toString()})(...injectionArgs)`, context);
      return [];
    } },
  };
  assert.equal((await sendLtmMessage(20, { action: "highlightLtmField", focused: false })).ok, true);
  for (const action of ["openViewProfilePage", "openCompanyDetailsTaba", "readCustomerProfile", "openBankDetailsTab", "readCustomerBankDetails"]) {
    assert.equal(listener({ action }, {}, () => assert.fail("Dedicated listeners must own these replies")), false);
  }
  const result = await sendLtmMessage(20, {
    action: "setLtmFieldValue", formKey: "activity_form", form: { name: "Activity Form" }, value: "5",
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /Open Activity Form/);
});
