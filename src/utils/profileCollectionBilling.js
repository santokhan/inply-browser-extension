import { CUSTOMER_DETAIL_FIELDS, missingCustomerDetails } from "./customerProfile.js";
import { profileCollectionDebit } from "./tenantWallet.js";

// Run inside one Firestore transaction: either both writes commit or neither does.
export async function saveCollectedProfile(transaction, {
  customerRef, walletRef, customer, profile, assertCurrentSession, timestamp,
}) {
  assertCurrentSession();
  const snapshot = await transaction.get(customerRef);
  if (!snapshot.exists()) throw new Error("The customer was removed before business details could be saved.");
  const saved = snapshot.data();
  if (saved.email?.trim().toLowerCase() !== customer.email.trim().toLowerCase()) {
    throw new Error("The customer email changed. Log in with the updated customer to collect details.");
  }
  const missing = missingCustomerDetails(saved, profile);
  if (Object.keys(missing).length) {
    const wallet = await transaction.get(walletRef);
    const debit = profileCollectionDebit(wallet.exists() ? wallet.data() : null);
    assertCurrentSession();
    transaction.update(walletRef, { ...debit, updatedAt: timestamp() });
    transaction.update(customerRef, { ...missing, updatedAt: timestamp() });
  }
  return Object.fromEntries(CUSTOMER_DETAIL_FIELDS.map((field) => [field, missing[field] || saved[field] || ""]));
}
