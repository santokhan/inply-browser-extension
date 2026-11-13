export const AUTOMATE_TENDER_ACTION = "automateTender";

export function normalizeTenderId(value) {
  const id = String(value ?? "").trim();
  if (!/^\d+$/.test(id)) throw new Error("Enter a numeric tender ID.");
  return id.replace(/^0+(?=\d)/, "");
}

// Serialized by executeScript, so this function must remain self-contained.
export function searchBasketTender(tenderId, expectedOrigin) {
  if (window.location.origin !== expectedOrigin) {
    return { ok: false, message: "The tender page left eProcure." };
  }
  const field = document.querySelector('table tbody tr td input[id="tenderId"]');
  const button = document.querySelector('input[type="submit"]#btnSearch');
  if (!field || !button || button.disabled) {
    return { ok: false, message: "The My Tenders search controls are unavailable. Check the eProcure tab and try again." };
  }
  field.value = tenderId;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  button.click();
  return { ok: true, message: `Search started for tender ${tenderId}.` };
}
