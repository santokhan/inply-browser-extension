export const COLLECT_CUSTOMER_PROFILE_ACTION = "collectCustomerProfile";
export const CUSTOMER_DETAIL_FIELDS = ["businessName", "registeredAddress", "bankName"];

export function missingCustomerDetails(current, collected) {
  return Object.fromEntries(CUSTOMER_DETAIL_FIELDS
    .filter((key) => !String(current?.[key] ?? "").trim() && typeof collected?.[key] === "string" && collected[key].trim())
    .map((key) => [key, collected[key].trim()]));
}
