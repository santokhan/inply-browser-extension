import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { normalizeTenderId } from "./tenderBasket.js";
import { automateTender } from "../background/tenderBasket.js";
import { SITE_ORIGIN } from "../config/site.js";
import { openTenders, searchTender } from "../content/tender.js";

afterEach(() => {
  for (const key of ["chrome", "window", "document"]) delete globalThis[key];
});

test("tender IDs normalize whitespace and leading zeroes and reject invalid input", () => {
  assert.equal(normalizeTenderId(" 001234 "), "1234");
  assert.equal(normalizeTenderId(1234), "1234");
  assert.equal(normalizeTenderId("000"), "0");
  for (const value of [undefined, null, "", "12 34", "-12", "12.3", "1e3", "abc"]) {
    assert.throws(() => normalizeTenderId(value), /numeric tender ID/);
  }
});

test("tender search fills the field and clicks Search with input and change events", () => {
  const search = searchTender;
  const events = [];
  const field = { dispatchEvent: (event) => events.push(event.type) };
  let clicks = 0;
  const button = { click: () => { clicks++; } };
  globalThis.window = { location: { origin: SITE_ORIGIN } };
  globalThis.document = { querySelector: (selector) => selector.includes("tenderId") ? field : button };
  assert.equal(search("1234", SITE_ORIGIN).ok, true);
  assert.equal(field.value, "1234");
  assert.deepEqual(events, ["input", "change"]);
  assert.equal(clicks, 1);
  globalThis.window.location.origin = "https://example.com";
  assert.equal(search("1234", SITE_ORIGIN).ok, false);
  assert.equal(clicks, 1);
});

test("missing or disabled tender controls report failure", () => {
  globalThis.window = { location: { origin: SITE_ORIGIN } };
  globalThis.document = { querySelector: () => null };
  assert.equal(searchTender("1234", SITE_ORIGIN).ok, false);
  globalThis.document.querySelector = () => ({ disabled: true });
  assert.equal(searchTender("1234", SITE_ORIGIN).ok, false);
});

test("My Tenders navigation clicks the website link and reports a missing link", () => {
  const open = openTenders;
  let clicks = 0;
  globalThis.window = { location: { origin: SITE_ORIGIN } };
  globalThis.document = {
    querySelector: () => null,
    querySelectorAll: () => [{ textContent: " My   Tenders ", click: () => { clicks++; } }],
  };
  assert.equal(open(SITE_ORIGIN).ok, true);
  assert.equal(clicks, 1);
  globalThis.document.querySelectorAll = () => [];
  assert.equal(open(SITE_ORIGIN).ok, false);
  globalThis.window.location.origin = "https://example.com";
  assert.equal(open(SITE_ORIGIN).ok, false);
  assert.equal(clicks, 1);
});

function browser({ verification = false, openFails = false, linkMissing = false, delayedReceiver = false } = {}) {
  const navigation = [];
  const clicks = [];
  const searches = [];
  let connectionAttempts = 0;
  const event = { addListener() {}, removeListener() {} };
  globalThis.chrome = {
    storage: { local: { set: async () => {} } },
    tabs: {
      query: async () => [{ id: 1, url: "https://example.com" }],
      create: async () => ({ id: 2 }),
      get: async () => ({ status: "complete", url: `${SITE_ORIGIN}/` }),
      update: async (tabId, options) => { navigation.push({ tabId, ...options }); },
      sendMessage: async (tabId, message, options) => {
        assert.equal(tabId, 2);
        assert.deepEqual(options, { frameId: 0 });
        if (delayedReceiver && connectionAttempts++ === 0) throw new Error("Receiving end does not exist");
        if (message.action === "openTenders") {
          clicks.push(message);
          if (openFails) throw new Error("Navigation failed.");
          return { ok: !linkMissing, message: "My Tenders link not found on this page." };
        }
        assert.equal(message.action, "searchTender");
        searches.push(message);
        return { ok: true, message: "Search started." };
      },
      onUpdated: event, onRemoved: event,
    },
    scripting: { executeScript: async ({ func, args, world }) => {
      if (func.name === "resolveCustomerLogout") {
        return [{ result: { ok: true, hasLogoutControl: args[0] === "inspectCustomerLogin", loginForm: true } }];
      }
      if (func.name === "submitCustomerLogin") {
        return [{ result: { ok: true, submitted: !verification, message: "Complete verification." } }];
      }
      assert.fail(`Unexpected script injection: ${func.name}`);
    } },
  };
  return { navigation, searches, clicks };
}

test("robot logs in and opens My Tenders without searching", async () => {
  const { navigation, searches, clicks } = browser();
  const result = await automateTender({ email: "customer@example.com", password: "password", tenderId: "001234" });
  assert.equal(result.ok, true);
  assert.equal(result.loginResult.submitted, true);
  assert.equal(result.loginResult.tabId, 2);
  assert.deepEqual(navigation, []);
  assert.deepEqual(clicks, [{ action: "openTenders", expectedOrigin: SITE_ORIGIN }]);
  assert.deepEqual(searches, []);
  assert.equal(result.message, "My Tenders opened.");
});

test("robot waits for the content-script receiver before sending tender actions", async () => {
  const { clicks, searches } = browser({ delayedReceiver: true });
  const result = await automateTender({ email: "customer@example.com", password: "password", tenderId: "1234" });
  assert.equal(result.ok, true);
  assert.equal(clicks.length, 1);
  assert.equal(searches.length, 0);
});

test("a missing My Tenders link stops automation before searching", async () => {
  const { navigation, searches } = browser({ linkMissing: true });
  const result = await automateTender({ email: "customer@example.com", password: "password", tenderId: "1234" });
  assert.equal(result.ok, false);
  assert.match(result.message, /link not found/);
  assert.equal(result.loginResult.submitted, true);
  assert.deepEqual(navigation, []);
  assert.deepEqual(searches, []);
});

test("robot pauses for manual login verification before navigating or searching", async () => {
  const { navigation, searches } = browser({ verification: true });
  const result = await automateTender({ email: "customer@example.com", password: "password", tenderId: "1234" });
  assert.equal(result.submitted, false);
  assert.deepEqual(navigation, []);
  assert.deepEqual(searches, []);
});

test("a navigation failure preserves confirmed login for the customer session", async () => {
  browser({ openFails: true });
  const result = await automateTender({ email: "customer@example.com", password: "password", tenderId: "1234" });
  assert.equal(result.ok, false);
  assert.equal(result.message, "Navigation failed.");
  assert.equal(result.loginResult.submitted, true);
});
