import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVE_CUSTOMER_KEY, activateExtensionCustomer, restoreExtensionCustomer } from "./extensionCustomer.js";

const customer = { id: "saved", email: " customer@example.com ", password: " exact password ", businessName: "Company", registeredAddress: "Dhaka" };

test("a submitted extension login selects its customer and prepares the encryption password", async () => {
  const writes = [];
  const active = await activateExtensionCustomer({ tenantUid: "owner", customer, loginResult: { ok: true, submitted: true } }, async (values) => writes.push(values));
  assert.deepEqual(writes, [{ encryptPassword: " exact password ", [ACTIVE_CUSTOMER_KEY]: active }]);
  assert.deepEqual(active, { tenantUid: "owner", id: "saved", email: "customer@example.com", businessName: "Company", registeredAddress: "Dhaka", bankName: "", profileTabId: null });
  assert.equal("password" in active, false);
});

test("only a submitted extension login selects its customer; an existing browser login does not", async () => {
  for (const loginResult of [undefined, { ok: true, message: "Already logged in" }, { ok: false }, null]) {
    assert.equal(await activateExtensionCustomer({ tenantUid: "owner", customer, loginResult },
      async () => assert.fail("An existing website session must not select a customer")), null);
  }
  const active = await activateExtensionCustomer({ tenantUid: "owner", customer, loginResult: { ok: true, submitted: true } }, async () => {});
  assert.equal(active.email, "customer@example.com");
});

test("newly collected business details are available to the active customer immediately", async () => {
  const active = await activateExtensionCustomer({
    tenantUid: "owner",
    customer: { ...customer, businessName: "", registeredAddress: "" },
    loginResult: { ok: true, submitted: true, profile: { businessName: "Collected Company", registeredAddress: "Collected address" } },
  }, async () => {});
  assert.equal(active.businessName, "Collected Company");
  assert.equal(active.registeredAddress, "Collected address");
});

test("requires tenant authentication and saved customer credentials after login submission", async () => {
  const write = async () => assert.fail("Invalid credentials must not be saved");
  const loginResult = { ok: true, submitted: true };
  await assert.rejects(activateExtensionCustomer({ customer, loginResult }, write), /Sign in/);
  await assert.rejects(activateExtensionCustomer({ tenantUid: "owner", customer: { email: customer.email }, loginResult }, write), /email and password/);
  await assert.rejects(activateExtensionCustomer({ tenantUid: "owner", customer: { password: customer.password }, loginResult }, write), /email and password/);
});

test("reopening the extension restores current saved business details for the selected customer", async () => {
  const stored = { tenantUid: "owner", id: "saved", email: "customer@example.com" };
  const active = await restoreExtensionCustomer(stored, "owner", async (id) => {
    assert.equal(id, "saved");
    return customer;
  });
  assert.equal(active.businessName, "Company");
  assert.equal(active.registeredAddress, "Dhaka");
  assert.equal("password" in active, false);
  assert.equal("password" in stored, false);
});

test("restoration cannot select another tenant's customer or a removed or changed account", async () => {
  const stored = { tenantUid: "owner", id: "saved", email: "customer@example.com" };
  const neverLoad = async () => assert.fail("Must not read another tenant's customer");
  assert.equal(await restoreExtensionCustomer(stored, "other", neverLoad), null);
  assert.equal(await restoreExtensionCustomer(stored, undefined, neverLoad), null);
  assert.equal(await restoreExtensionCustomer(undefined, "owner", neverLoad), null);
  assert.equal(await restoreExtensionCustomer(stored, "owner", async () => null), null);
  assert.equal(await restoreExtensionCustomer(stored, "owner", async () => ({ email: "changed@example.com" })), null);
});

test("bank details and the login tab survive customer activation and restoration", async () => {
  const active = await activateExtensionCustomer({
    tenantUid: "owner", customer: { ...customer, bankName: "Saved Bank" },
    loginResult: { ok: true, submitted: true, tabId: 7 },
  }, async () => {});
  assert.equal(active.bankName, "Saved Bank");
  assert.equal(active.profileTabId, 7);
  const restored = await restoreExtensionCustomer(active, "owner", async () => ({ ...customer, bankName: "Updated Bank" }));
  assert.equal(restored.bankName, "Updated Bank");
  assert.equal(restored.profileTabId, 7);
});
