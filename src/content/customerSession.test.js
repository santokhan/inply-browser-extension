import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import { ACTIVE_CUSTOMER_KEY } from "../utils/extensionCustomer.js";

const source = (await readFile(new URL("./customerSession.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "").replace("export function", "function");
const resolver = (await readFile(new URL("./customerLogout.js", import.meta.url), "utf8"))
  .replace("export function", "function");

function page({ logout = true, active = true, readyState = "complete", origin = "https://www.eprocure.gov.bd" } = {}) {
  let anchors = logout ? [{ href: `${origin}/Logout.jsp` }] : [];
  let stored = active ? { email: "customer@example.com" } : undefined;
  let pending;
  let mutation;
  let storageChanged;
  const removals = [];
  const events = {};
  const window = { location: { origin, href: `${origin}/` }, addEventListener: (name, callback) => { events[name] = callback; } };
  window.top = window;
  const document = { readyState, documentElement: {}, querySelectorAll: () => anchors, querySelector: () => null };
  const context = createContext({
    window, document, URL, console, ACTIVE_CUSTOMER_KEY,
    setTimeout: (callback) => { pending = callback; },
    clearTimeout: () => { pending = undefined; },
    MutationObserver: class {
      constructor(callback) { mutation = callback; }
      observe() {}
    },
    chrome: { storage: {
      local: {
        get: async () => ({ [ACTIVE_CUSTOMER_KEY]: stored }),
        remove: async (key) => { removals.push(key); stored = undefined; },
      },
      onChanged: { addListener: (callback) => { storageChanged = callback; } },
    } },
  });
  runInContext(`${resolver}\n${source}\ninstallCustomerSessionMonitor();`, context);
  return {
    removals, document,
    flush: async () => { const callback = pending; pending = undefined; await callback?.(); },
    removeLogout: () => { anchors = []; mutation(); },
    renderLogout: () => { anchors = [{ href: `${origin}/Logout.jsp` }]; mutation(); },
    load: () => { document.readyState = "complete"; events.load(); },
    activate: () => { stored = { email: "customer@example.com" }; storageChanged({ [ACTIVE_CUSTOMER_KEY]: { newValue: stored } }, "local"); },
  };
}

test("clears the extension customer on a loaded page without Logout, even without a login form", async () => {
  const browser = page({ logout: false });
  await browser.flush();
  assert.deepEqual(browser.removals, [ACTIVE_CUSTOMER_KEY]);
});

test("keeps the customer while Logout exists and clears it when the link disappears", async () => {
  const browser = page();
  await browser.flush();
  assert.deepEqual(browser.removals, []);
  browser.removeLogout();
  await browser.flush();
  assert.deepEqual(browser.removals, [ACTIVE_CUSTOMER_KEY]);
});

test("waits for loading and lets a rendered Logout link cancel a pending logout", async () => {
  const browser = page({ logout: false, readyState: "loading" });
  await browser.flush();
  assert.deepEqual(browser.removals, []);
  browser.load();
  browser.renderLogout();
  await browser.flush();
  assert.deepEqual(browser.removals, []);
});

test("checks newly activated customers without affecting empty sessions or unrelated sites", async () => {
  const browser = page({ logout: false, active: false });
  await browser.flush();
  assert.deepEqual(browser.removals, []);
  browser.activate();
  await browser.flush();
  assert.deepEqual(browser.removals, [ACTIVE_CUSTOMER_KEY]);
  const unrelated = page({ logout: false, origin: "https://example.com" });
  await unrelated.flush();
  assert.deepEqual(unrelated.removals, []);
});
