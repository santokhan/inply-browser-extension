export const AUTOMATE_TENDER_ACTION = "automateTender";

export function normalizeTenderId(value) {
  const id = String(value ?? "").trim();
  if (!/^\d+$/.test(id)) throw new Error("Enter a numeric tender ID.");
  return id.replace(/^0+(?=\d)/, "");
}
