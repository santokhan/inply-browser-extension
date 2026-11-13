import assert from "node:assert/strict";
import { test } from "node:test";
import { nextWalletGrantAt, walletWeek, weeklyWalletUpdate, WEEK_MS } from "./tenantWallet.js";

const monday = Date.parse("2026-11-09T00:00:00Z");

test("new tenants receive 50 credits in their first week", () => {
  assert.deepEqual(weeklyWalletUpdate(null, monday), {
    grantBalance: 50, purchasedBalance: 0, lastGrantWeek: walletWeek(monday),
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
    grantBalance: 50, purchasedBalance: 0, lastGrantWeek: walletWeek(monday),
  });
  assert.equal(nextWalletGrantAt(monday - 1), monday);
  assert.equal(nextWalletGrantAt(monday), monday + WEEK_MS);
});

test("unused grants expire and missed weeks do not accumulate", () => {
  const wallet = { grantBalance: 27, purchasedBalance: 125, lastGrantWeek: walletWeek(monday) };
  const update = weeklyWalletUpdate(wallet, monday + 3 * WEEK_MS);
  assert.deepEqual(update, { grantBalance: 50, purchasedBalance: 125, lastGrantWeek: walletWeek(monday) + 3 });
  assert.deepEqual(wallet, { grantBalance: 27, purchasedBalance: 125, lastGrantWeek: walletWeek(monday) });
  // A Firestore retry reads the winning write and must not grant again.
  assert.equal(weeklyWalletUpdate(update, monday + 3 * WEEK_MS), null);
});

test("a clock behind the last grant never removes credits or grants again", () => {
  const wallet = weeklyWalletUpdate(null, monday);
  assert.equal(weeklyWalletUpdate(wallet, monday - WEEK_MS), null);
});

test("invalid or overflowing balances cannot be credited", () => {
  for (const balance of [-1, 1.5, "50", NaN, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => weeklyWalletUpdate({ grantBalance: balance, purchasedBalance: 0, lastGrantWeek: walletWeek(monday) }, monday));
    assert.throws(() => weeklyWalletUpdate({ grantBalance: 50, purchasedBalance: balance, lastGrantWeek: walletWeek(monday) }, monday));
  }
  assert.throws(() => weeklyWalletUpdate({ grantBalance: 51, purchasedBalance: 0, lastGrantWeek: walletWeek(monday) }, monday));
  assert.throws(() => weeklyWalletUpdate({ grantBalance: 50, purchasedBalance: 0 }, monday));
});

test("the free-credit bucket refills independently of the main balance", () => {
  const wallet = { grantBalance: 0, purchasedBalance: Number.MAX_SAFE_INTEGER, lastGrantWeek: walletWeek(monday) };
  const update = weeklyWalletUpdate(wallet, monday + WEEK_MS);
  assert.deepEqual(update, {
    grantBalance: 50, purchasedBalance: Number.MAX_SAFE_INTEGER, lastGrantWeek: walletWeek(monday) + 1,
  });
  assert.equal(weeklyWalletUpdate(update, monday + WEEK_MS), null);
});

test("spent weekly grants cannot be replenished during the same week", () => {
  assert.equal(weeklyWalletUpdate({ grantBalance: 0, purchasedBalance: 125, lastGrantWeek: walletWeek(monday) }, monday), null);
});

test("purchased credits survive repeated weekly resets", () => {
  let wallet = { grantBalance: 0, purchasedBalance: 300, lastGrantWeek: walletWeek(monday) };
  for (let week = 1; week <= 52; week += 1) {
    wallet = weeklyWalletUpdate(wallet, monday + week * WEEK_MS);
    assert.equal(wallet.purchasedBalance, 300);
    assert.equal(wallet.grantBalance, 50);
  }
});

test("legacy balances migrate as grants with no purchased credits", () => {
  const lastGrantWeek = walletWeek(monday);
  for (const balance of [0, 27, 50, 250]) {
    assert.deepEqual(weeklyWalletUpdate({ balance, lastGrantWeek }, monday), {
      grantBalance: Math.min(balance, 50), purchasedBalance: 0, lastGrantWeek,
    });
    assert.deepEqual(weeklyWalletUpdate({ balance, lastGrantWeek }, monday + 3 * WEEK_MS), {
      grantBalance: 50, purchasedBalance: 0, lastGrantWeek: lastGrantWeek + 3,
    });
  }
  assert.throws(() => weeklyWalletUpdate({ balance: 50, lastGrantWeek: lastGrantWeek + 1 }, monday));
  assert.throws(() => weeklyWalletUpdate({ balance: 50, purchasedBalance: 100, lastGrantWeek }, monday));
});
