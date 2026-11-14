import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmCustomerLoggedOut } from "./customerSession.js";
import { ACTIVE_CUSTOMER_KEY } from "../utils/extensionCustomer.js";

function setup({ tabId = 7, session = { ok: true, loginForm: true, hasLogoutControl: false }, changeCustomer = false } = {}) {
  let stored = { tenantUid: "owner", email: "customer@example.com", profileTabId: 7 };
  const removals = [];
  let inspections = 0;
  globalThis.chrome = {
    runtime: { id: "extension" },
    storage: { local: {
      get: async () => ({ [ACTIVE_CUSTOMER_KEY]: stored }),
      remove: async (key) => { removals.push(key); },
    } },
    scripting: { executeScript: async () => {
      inspections++;
      if (changeCustomer) stored = { ...stored, email: "other@example.com" };
      return [{ result: session }];
    } },
  };
  return {
    sender: { id: "extension", frameId: 0, url: "https://www.eprocure.gov.bd/", tab: { id: tabId } },
    removals,
    inspections: () => inspections,
  };
}

test("clears a confirmed logged-out customer on its own tab", async () => {
  const browser = setup();
  await confirmCustomerLoggedOut(browser.sender, () => false);
  assert.deepEqual(browser.removals, [ACTIVE_CUSTOMER_KEY]);
});

test("an old login tab cannot clear the customer", async () => {
  const browser = setup({ tabId: 8 });
  await confirmCustomerLoggedOut(browser.sender, () => false);
  assert.equal(browser.inspections(), 0);
  assert.deepEqual(browser.removals, []);
});

test("requires a fresh confirmed login form without Logout", async () => {
  for (const session of [{ ok: true, loginForm: false }, { ok: true, loginForm: true, hasLogoutControl: true }, { ok: false }]) {
    const browser = setup({ session });
    await confirmCustomerLoggedOut(browser.sender, () => false);
    assert.deepEqual(browser.removals, []);
  }
});

test("preserves customers during login and when the selection changes during inspection", async () => {
  let browser = setup();
  await confirmCustomerLoggedOut(browser.sender, () => true);
  assert.equal(browser.inspections(), 0);
  assert.deepEqual(browser.removals, []);
  browser = setup({ changeCustomer: true });
  await confirmCustomerLoggedOut(browser.sender, () => false);
  assert.deepEqual(browser.removals, []);
});

test("rejects reports from other sites, extensions, and subframes", async () => {
  for (const overrides of [{ url: "https://example.com/" }, { id: "other" }, { frameId: 1 }]) {
    const browser = setup();
    await confirmCustomerLoggedOut({ ...browser.sender, ...overrides }, () => false);
    assert.equal(browser.inspections(), 0);
  }
});
