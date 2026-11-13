import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, tenantAuth } from "./config";
import { weeklyWalletUpdate } from "../utils/tenantWallet.js";

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
