import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, tenantAuth } from "./config";
import { weeklyWalletUpdate } from "../utils/tenantWallet.js";
import { tenantTenderBasketPath } from "../data/tenantCustomerPaths.js";
import { saveCompletedTenderAutomation } from "../utils/robotAutomationBilling.js";

export async function completeTenderAutomation(tenantUid, tenderId) {
  await tenantAuth.authStateReady();
  const assertCurrentSession = () => {
    if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) {
      throw new Error("Sign in again to complete Robot automation.");
    }
  };
  assertCurrentSession();
  const options = {
    tenderBasketRef: doc(db, ...tenantTenderBasketPath(tenantUid)),
    walletRef: doc(db, "tenantWallets", tenantUid),
    tenderId, assertCurrentSession, timestamp: serverTimestamp,
  };
  const complete = () => runTransaction(db, (transaction) => saveCompletedTenderAutomation(transaction, options));
  let result = await complete();
  if (result.needsWalletRefresh) {
    await refreshTenantWallet(tenantUid);
    result = await complete();
    if (result.needsWalletRefresh) throw new Error("Refresh your wallet and try again.");
  }
  return result;
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
