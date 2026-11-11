// Legacy Firestore collection name retained so existing tenant data stays available.
const TENANT_CUSTOMERS_COLLECTION = "customerOwners";

export function tenantCustomersPath(tenantUid) {
  return [TENANT_CUSTOMERS_COLLECTION, tenantUid, "customers"];
}

export function tenantCustomerPath(tenantUid, customerId) {
  return [...tenantCustomersPath(tenantUid), customerId];
}
