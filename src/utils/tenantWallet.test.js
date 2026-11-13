import assert from "node:assert/strict";
import { test } from "node:test";
import { nextWalletGrantAt, walletWeek, weeklyWalletUpdate, WEEK_MS } from "./tenantWallet.js";

const monday = Date.parse("2026-11-09T00:00:00Z");

test("new tenants receive 50 credits in their first week", () => {
  assert.deepEqual(weeklyWalletUpdate(null, monday), {
    balance: 50, lastGrantWeek: walletWeek(monday),
  });
});

test("repeated opens in the same week do not grant additional credits", () => {
  const wallet = weeklyWalletUpdate(null, monday);
  assert.equal(weeklyWalletUpdate(wallet, monday), null);
  assert.equal(weeklyWalletUpdate(wallet, monday + WEEK_MS - 1), null);
});

test("the grant boundary is Monday midnight UTC", () => {
  const wallet = weeklyWalletUpdate(null, monday - 1);
  assert.deepEqual(weeklyWalletUpdate(wallet, monday), {
    balance: 100, lastGrantWeek: walletWeek(monday),
  });
  assert.equal(nextWalletGrantAt(monday - 1), monday);
  assert.equal(nextWalletGrantAt(monday), monday + WEEK_MS);
});

test("unused credits and grants from missed weeks accumulate", () => {
  const wallet = { balance: 27, lastGrantWeek: walletWeek(monday) };
  const update = weeklyWalletUpdate(wallet, monday + 3 * WEEK_MS);
  assert.deepEqual(update, { balance: 177, lastGrantWeek: walletWeek(monday) + 3 });
  assert.deepEqual(wallet, { balance: 27, lastGrantWeek: walletWeek(monday) });
  // A Firestore retry reads the winning write and must not grant again.
  assert.equal(weeklyWalletUpdate(update, monday + 3 * WEEK_MS), null);
});

test("a clock behind the last grant never removes credits or grants again", () => {
  const wallet = weeklyWalletUpdate(null, monday);
  assert.equal(weeklyWalletUpdate(wallet, monday - WEEK_MS), null);
});

test("invalid or overflowing balances cannot be credited", () => {
  for (const balance of [-1, 1.5, "50", NaN]) {
    assert.throws(() => weeklyWalletUpdate({ balance, lastGrantWeek: walletWeek(monday) }, monday));
  }
  assert.throws(() => weeklyWalletUpdate({ balance: 50 }, monday));
  assert.throws(() => weeklyWalletUpdate({ balance: Number.MAX_SAFE_INTEGER, lastGrantWeek: walletWeek(monday) - 1 }, monday));
});
