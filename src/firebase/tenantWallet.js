import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, tenantAuth } from "./config";
import { submissionLetterDebit, weeklyWalletUpdate } from "../utils/tenantWallet.js";

export async function chargeSubmissionLetter(tenantUid) {
  await refreshTenantWallet(tenantUid);
  const reference = doc(db, "tenantWallets", tenantUid);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (tenantAuth.currentUser?.uid !== tenantUid) {
      throw new Error("Sign in again to use Fill Sign Encrypt Save.");
    }
    const debit = submissionLetterDebit(snapshot.exists() ? snapshot.data() : null);
    transaction.update(reference, { ...debit, updatedAt: serverTimestamp() });
  });
}

export function subscribeTenantWallet(tenantUid, onWallet, onError) {
  return onSnapshot(doc(db, "tenantWallets", tenantUid), (snapshot) => {
    onWallet(snapshot.exists() ? snapshot.data() : null);
  }, onError);
}

export async function refreshTenantWallet(tenantUid) {
  await tenantAuth.authStateReady();
  if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) {
    throw new Error("Sign in to load your tenant wallet.");
  }
  const reference = doc(db, "tenantWallets", tenantUid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const wallet = snapshot.exists() ? snapshot.data() : null;
    const update = weeklyWalletUpdate(wallet);
    if (!update) return wallet;

    transaction.set(reference, {
      ...update,
      createdAt: wallet ? wallet.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return update;
  });
}
