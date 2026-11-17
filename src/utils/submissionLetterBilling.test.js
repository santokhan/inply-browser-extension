import assert from "node:assert/strict";
import { test } from "node:test";
import { submissionLetterDebit, walletWeek, WEEK_MS } from "./tenantWallet.js";

const wallet = (grantBalance, purchasedBalance = 0) => ({
  grantBalance, purchasedBalance, lastGrantWeek: walletWeek(),
});

test("submission letters cost one credit using free credits first", () => {
  assert.deepEqual(submissionLetterDebit(wallet(50, 10)), { grantBalance: 49, purchasedBalance: 10 });
  assert.deepEqual(submissionLetterDebit(wallet(1, 10)), { grantBalance: 0, purchasedBalance: 10 });
  assert.deepEqual(submissionLetterDebit(wallet(0, 10)), { grantBalance: 0, purchasedBalance: 9 });
});

test("empty, stale and invalid wallets cannot pay for submission letters", () => {
  assert.throws(() => submissionLetterDebit(wallet(0)), /need 1 credit/);
  assert.throws(() => submissionLetterDebit(null), /Refresh your wallet/);
  assert.throws(() => submissionLetterDebit(wallet(50), Date.now() + WEEK_MS), /Refresh your wallet/);
  assert.throws(() => submissionLetterDebit(wallet(-1)), /wallet data is invalid/);
  assert.throws(() => submissionLetterDebit({ balance: 50, lastGrantWeek: walletWeek() }), /Refresh your wallet/);
});
