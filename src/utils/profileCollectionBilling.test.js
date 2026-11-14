import assert from "node:assert/strict";
import { test } from "node:test";
import { saveCollectedProfile } from "./profileCollectionBilling.js";
import { profileCollectionDebit, walletWeek, WEEK_MS } from "./tenantWallet.js";

const wallet = (grantBalance, purchasedBalance = 0) => ({ grantBalance, purchasedBalance, lastGrantWeek: walletWeek() });

test("collection spends five credits using grants before purchased credits", () => {
  assert.deepEqual(profileCollectionDebit(wallet(50, 10)), { grantBalance: 45, purchasedBalance: 10 });
  assert.deepEqual(profileCollectionDebit(wallet(2, 10)), { grantBalance: 0, purchasedBalance: 7 });
  assert.deepEqual(profileCollectionDebit(wallet(0, 5)), { grantBalance: 0, purchasedBalance: 0 });
  assert.throws(() => profileCollectionDebit(wallet(2, 2)), /need 5 credits/);
  assert.throws(() => profileCollectionDebit(null), /Refresh your wallet/);
  assert.throws(() => profileCollectionDebit(wallet(50), Date.now() + WEEK_MS), /Refresh your wallet/);
});

function collection(saved = {}, balance = wallet(50), exists = true) {
  const writes = [];
  const records = { customer: { email: "customer@example.com", ...saved }, wallet: balance };
  return {
    writes,
    records,
    transaction: {
      get: async (ref) => ({ exists: () => ref === "customer" ? exists : Boolean(records[ref]), data: () => records[ref] }),
      update: (ref, values) => writes.push({ ref, values }),
    },
    options: {
      customerRef: "customer", walletRef: "wallet", customer: { email: "customer@example.com" },
      profile: { businessName: " New Business ", bankName: "New Bank" },
      assertCurrentSession: () => {}, timestamp: () => "server timestamp",
    },
  };
}

test("saving multiple new fields makes one debit and preserves saved details", async () => {
  const { transaction, options, writes } = collection({ bankName: "Saved Bank" }, wallet(2, 10));
  const details = await saveCollectedProfile(transaction, options);
  assert.equal(details.businessName, "New Business");
  assert.equal(details.bankName, "Saved Bank");
  assert.deepEqual(writes, [
    { ref: "wallet", values: { grantBalance: 0, purchasedBalance: 7, updatedAt: "server timestamp" } },
    { ref: "customer", values: { businessName: "New Business", updatedAt: "server timestamp" } },
  ]);
});

test("empty results and retries with already saved fields make no charge or writes", async () => {
  for (const saved of [{ businessName: "Existing", bankName: "Existing" }, {}]) {
    const { transaction, options, writes } = collection(saved);
    if (!saved.businessName) options.profile = { businessName: " " };
    await saveCollectedProfile(transaction, options);
    assert.deepEqual(writes, []);
  }
});

test("insufficient funds, missing wallet, removed customer and session changes prevent all writes", async () => {
  for (const setup of [collection({}, wallet(4)), collection({}, null), collection({}, wallet(50), false)]) {
    await assert.rejects(saveCollectedProfile(setup.transaction, setup.options));
    assert.deepEqual(setup.writes, []);
  }
  const setup = collection();
  setup.options.assertCurrentSession = () => { throw new Error("Session changed"); };
  await assert.rejects(saveCollectedProfile(setup.transaction, setup.options), /Session changed/);
  assert.deepEqual(setup.writes, []);
});

test("transaction retry sees saved details and avoids a second charge", async () => {
  const { transaction, options, records, writes } = collection();
  await saveCollectedProfile(transaction, options);
  for (const { ref, values } of writes) Object.assign(records[ref], values);
  writes.length = 0;
  await saveCollectedProfile(transaction, options);
  assert.deepEqual(writes, []);
  assert.equal(records.wallet.grantBalance, 45);
});
