import { SITE_ORIGIN } from "../config/site.js";
import { loginCustomer, waitForLoginTab } from "../utils/customerLogin.js";
import { normalizeTenderId, searchBasketTender } from "../utils/tenderBasket.js";

export async function automateTender(message) {
  const tenderId = normalizeTenderId(message.tenderId);
  const loginResult = await loginCustomer(message);
  if (!loginResult?.ok || !loginResult.submitted) return loginResult;
  try {
    await chrome.tabs.update(loginResult.tabId, {
      url: `${SITE_ORIGIN}/tenderer/MyTenders.jsp`, active: true,
    });
    await waitForLoginTab(loginResult.tabId);
    const results = await chrome.scripting.executeScript({
      target: { tabId: loginResult.tabId },
      func: searchBasketTender,
      args: [tenderId, SITE_ORIGIN],
    });
    const result = results[0]?.result;
    return { ...result, ok: Boolean(result?.ok), loginResult,
      message: result?.message || "Could not search for this tender." };
  } catch (error) {
    return { ok: false, loginResult, message: error.message || "Could not open the tender search." };
  }
}
