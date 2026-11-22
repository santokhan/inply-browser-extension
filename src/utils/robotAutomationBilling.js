import { getTenderStatus, normalizeTenderId, updateTenderBasket } from "./tenderBasket.js";
import { robotAutomationDebit, weeklyWalletUpdate } from "./tenantWallet.js";

export async function saveCompletedTenderAutomation(transaction, {
  tenderBasketRef, walletRef, tenderId, assertCurrentSession, timestamp,
}) {
  assertCurrentSession();
  const id = normalizeTenderId(tenderId);
  const basket = await transaction.get(tenderBasketRef);
  if (!basket.exists()) throw new Error("This tender is no longer in the basket.");
  const saved = basket.data();
  const completed = updateTenderBasket(saved, { action: "status", tenderId: id, status: "completed" });
  if (getTenderStatus(saved.tenderStatuses, id) === "completed") return { charged: false };

  const snapshot = await transaction.get(walletRef);
  const wallet = snapshot.exists() ? snapshot.data() : null;
  if (weeklyWalletUpdate(wallet)) return { needsWalletRefresh: true };
  const debit = robotAutomationDebit(wallet);
  assertCurrentSession();
  transaction.update(walletRef, { ...debit, updatedAt: timestamp() });
  transaction.update(tenderBasketRef, { ...completed, updatedAt: timestamp() });
  return { charged: true };
}
