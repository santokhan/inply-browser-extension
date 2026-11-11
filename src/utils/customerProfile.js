export function missingCustomerDetails(current, collected) {
  return Object.fromEntries(["businessName", "registeredAddress"]
    .filter((key) => !String(current?.[key] ?? "").trim() && typeof collected?.[key] === "string" && collected[key].trim())
    .map((key) => [key, collected[key].trim()]));
}
