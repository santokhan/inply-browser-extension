import assert from "node:assert/strict";
import { test } from "node:test";
import { saveCompletedTenderAutomation } from "./robotAutomationBilling.js";
import { robotAutomationDebit, walletWeek, WEEK_MS } from "./tenantWallet.js";

const wallet = (grantBalance, purchasedBalance = 0) => ({
  grantBalance, purchasedBalance, lastGrantWeek: walletWeek(),
});

function completion(balance = wallet(50)) {
  const records = {
    customer: { tenderIds: ["123", "456"], tenderStatuses: { 123: "pending", 456: "encrypted" } },
    wallet: balance,
  };
  const writes = [];
  return {
    records, writes,
    transaction: {
      get: async (ref) => ({ exists: () => Boolean(records[ref]), data: () => records[ref] }),
      update: (ref, values) => writes.push({ ref, values }),
    },
    options: {
      customerRef: "customer", walletRef: "wallet", tenderId: "00123",
      assertCurrentSession: () => {}, timestamp: () => "server timestamp",
    },
  };
}

test("completed Robot automation costs six credits using free credits first", () => {
  assert.deepEqual(robotAutomationDebit(wallet(50, 10)), { grantBalance: 44, purchasedBalance: 10 });
  assert.deepEqual(robotAutomationDebit(wallet(2, 10)), { grantBalance: 0, purchasedBalance: 6 });
  assert.deepEqual(robotAutomationDebit(wallet(0, 6)), { grantBalance: 0, purchasedBalance: 0 });
  assert.throws(() => robotAutomationDebit(wallet(5)), /need 6 credits/);
});

test("completion writes one charge and the tender status in the same transaction", async () => {
  const { transaction, options, writes } = completion(wallet(2, 10));
  assert.deepEqual(await saveCompletedTenderAutomation(transaction, options), { charged: true });
  assert.deepEqual(writes, [
    { ref: "wallet", values: { grantBalance: 0, purchasedBalance: 6, updatedAt: "server timestamp" } },
    { ref: "customer", values: {
      tenderIds: ["123", "456"], tenderStatuses: { 123: "completed", 456: "encrypted" }, updatedAt: "server timestamp",
    } },
  ]);
});

test("retrying an already completed tender does not charge again", async () => {
  const { transaction, options, records, writes } = completion();
  await saveCompletedTenderAutomation(transaction, options);
  for (const { ref, values } of writes) Object.assign(records[ref], values);
  writes.length = 0;
  assert.deepEqual(await saveCompletedTenderAutomation(transaction, options), { charged: false });
  assert.deepEqual(writes, []);
  assert.equal(records.wallet.grantBalance, 44);
});

test("insufficient credits and removed tenders or customers prevent all completion writes", async () => {
  for (const change of [
    (setup) => { setup.records.wallet = wallet(5); },
    (setup) => { setup.records.customer.tenderIds = []; },
    (setup) => { setup.records.customer = null; },
    (setup) => { setup.options.assertCurrentSession = () => { throw new Error("Session changed"); }; },
  ]) {
    const setup = completion();
    change(setup);
    await assert.rejects(saveCompletedTenderAutomation(setup.transaction, setup.options));
    assert.deepEqual(setup.writes, []);
  }
});

test("missing, legacy and stale wallets request refresh before any completion writes", async () => {
  for (const balance of [null, { balance: 50, lastGrantWeek: walletWeek() },
    { ...wallet(0), lastGrantWeek: walletWeek() - 1 }]) {
    const { transaction, options, writes } = completion(balance);
    assert.deepEqual(await saveCompletedTenderAutomation(transaction, options), { needsWalletRefresh: true });
    assert.deepEqual(writes, []);
  }
  assert.throws(() => robotAutomationDebit(wallet(50), Date.now() + WEEK_MS), /Refresh your wallet/);
});
