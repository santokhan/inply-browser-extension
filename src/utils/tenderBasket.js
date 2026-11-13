export const AUTOMATE_TENDER_ACTION = "automateTender";

export const TENDER_STATUSES = Object.freeze([
  "pending", "encrypted", "mapped", "submitted",
]);

export function getTenderStatus(tenderStatuses, tenderId) {
  const status = tenderStatuses?.[tenderId];
  return TENDER_STATUSES.includes(status) ? status : "pending";
}

// Keep IDs compatible with existing customers while storing status per ID.
// Called with the latest document inside a transaction to preserve other edits.
export function updateTenderBasket(data, { action, tenderId, status }) {
  const id = normalizeTenderId(tenderId);
  let tenderIds = [...(data.tenderIds ?? [])];
  const exists = tenderIds.includes(id);
  if (action === "add") {
    if (exists) throw new Error("This tender is already in the basket.");
    tenderIds.push(id);
  } else if (action === "remove") {
    tenderIds = tenderIds.filter((value) => value !== id);
  } else if (action === "status") {
    if (!exists) throw new Error("This tender is no longer in the basket.");
    if (!TENDER_STATUSES.includes(status)) throw new Error("Choose a valid tender status.");
  } else {
    throw new Error("Unknown tender basket action.");
  }
  const tenderStatuses = Object.fromEntries(tenderIds.map((value) => [
    value, value === id && action === "add" ? "pending" : getTenderStatus(data.tenderStatuses, value),
  ]));
  if (action === "status") tenderStatuses[id] = status;
  return { tenderIds, tenderStatuses };
}

export function normalizeTenderId(value) {
  const id = String(value ?? "").trim();
  if (!/^\d+$/.test(id)) throw new Error("Enter a numeric tender ID.");
  return id.replace(/^0+(?=\d)/, "");
}
