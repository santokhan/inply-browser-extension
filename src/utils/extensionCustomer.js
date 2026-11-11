// Only the extension's customer Login flow can select the active customer.
export const ACTIVE_CUSTOMER_KEY = "activeExtensionCustomer";

export async function activateExtensionCustomer({ tenantUid, customer, loginResult }, write) {
  if (!loginResult?.ok || !loginResult.submitted) return null;
  if (!tenantUid) throw new Error("Sign in to the extension before selecting a customer.");
  if (!customer?.email?.trim() || !customer.password) throw new Error("Enter the customer email and password.");
  const active = {
    tenantUid,
    id: customer.id || null,
    email: customer.email.trim(),
    businessName: customer.businessName || loginResult.profile?.businessName || "",
    registeredAddress: customer.registeredAddress || loginResult.profile?.registeredAddress || "",
    bankName: customer.bankName || loginResult.profile?.bankName || "",
    profileTabId: loginResult.tabId ?? null,
  };
  await write({ encryptPassword: customer.password, [ACTIVE_CUSTOMER_KEY]: active });
  return active;
}

export async function restoreExtensionCustomer(stored, tenantUid, loadCustomer) {
  if (!tenantUid || stored?.tenantUid !== tenantUid || !stored.email) return null;
  if (!stored.id) return stored;
  const customer = await loadCustomer(stored.id);
  if (!customer || customer.email?.trim().toLowerCase() !== stored.email.trim().toLowerCase()) return null;
  return {
    ...stored,
    businessName: customer.businessName ?? stored.businessName ?? "",
    registeredAddress: customer.registeredAddress ?? stored.registeredAddress ?? "",
    bankName: customer.bankName ?? stored.bankName ?? "",
  };
}
