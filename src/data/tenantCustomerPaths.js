// Legacy Firestore collection name retained so existing tenant data stays available.
const TENANT_CUSTOMERS_COLLECTION = "customerOwners";
const TENANT_TENDER_BASKETS_COLLECTION = "tenantTenderBaskets";

export function tenantCustomersPath(tenantUid) {
  return [TENANT_CUSTOMERS_COLLECTION, tenantUid, "customers"];
}

export function tenantCustomerPath(tenantUid, customerId) {
  return [...tenantCustomersPath(tenantUid), customerId];
}

export function tenantTenderBasketPath(tenantUid) {
  return [TENANT_TENDER_BASKETS_COLLECTION, tenantUid];
}
