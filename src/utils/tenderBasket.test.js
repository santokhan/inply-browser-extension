import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { normalizeTenderId, searchBasketTender } from "./tenderBasket.js";
import { automateTender } from "../background/tenderBasket.js";
import { SITE_ORIGIN } from "../config/site.js";

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

test("serialized tender search fills the field and clicks Search with input and change events", () => {
  const search = (0, eval)(`(${searchBasketTender.toString()})`);
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
  assert.equal(searchBasketTender("1234", SITE_ORIGIN).ok, false);
  globalThis.document.querySelector = () => ({ disabled: true });
  assert.equal(searchBasketTender("1234", SITE_ORIGIN).ok, false);
});

function browser({ verification = false, searchFails = false } = {}) {
  const navigation = [];
  const searches = [];
  const event = { addListener() {}, removeListener() {} };
  globalThis.chrome = {
    storage: { local: { set: async () => {} } },
    tabs: {
      query: async () => [{ id: 1, url: "https://example.com" }],
      create: async () => ({ id: 2 }),
      get: async () => ({ status: "complete", url: `${SITE_ORIGIN}/` }),
      update: async (tabId, options) => { navigation.push({ tabId, ...options }); },
      onUpdated: event, onRemoved: event,
    },
    scripting: { executeScript: async ({ func, args }) => {
      if (func.name === "resolveCustomerLogout") {
        return [{ result: { ok: true, hasLogoutControl: args[0] === "inspectCustomerLogin", loginForm: true } }];
      }
      if (func.name === "submitCustomerLogin") {
        return [{ result: { ok: true, submitted: !verification, message: "Complete verification." } }];
      }
      searches.push(args);
      if (searchFails) throw new Error("Search failed.");
      return [{ result: { ok: true, message: "Search started." } }];
    } },
  };
  return { navigation, searches };
}

test("robot logs in then opens My Tenders and searches the normalized ID", async () => {
  const { navigation, searches } = browser();
  const result = await automateTender({ email: "customer@example.com", password: "password", tenderId: "001234" });
  assert.equal(result.ok, true);
  assert.equal(result.loginResult.submitted, true);
  assert.equal(result.loginResult.tabId, 2);
  assert.deepEqual(navigation, [{ tabId: 2, url: `${SITE_ORIGIN}/tenderer/MyTenders.jsp`, active: true }]);
  assert.deepEqual(searches, [["1234", SITE_ORIGIN]]);
});

test("robot pauses for manual login verification before navigating or searching", async () => {
  const { navigation, searches } = browser({ verification: true });
  const result = await automateTender({ email: "customer@example.com", password: "password", tenderId: "1234" });
  assert.equal(result.submitted, false);
  assert.deepEqual(navigation, []);
  assert.deepEqual(searches, []);
});

test("a search failure preserves confirmed login for the customer session", async () => {
  browser({ searchFails: true });
  const result = await automateTender({ email: "customer@example.com", password: "password", tenderId: "1234" });
  assert.equal(result.ok, false);
  assert.equal(result.message, "Search failed.");
  assert.equal(result.loginResult.submitted, true);
});
