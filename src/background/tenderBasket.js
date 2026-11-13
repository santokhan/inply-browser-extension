import { SITE_ORIGIN } from "../config/site.js";
import { loginCustomer, waitForLoginTab } from "../utils/customerLogin.js";

async function sendTenderMessage(tabId, message) {
  const deadline = Date.now() + 30000;
  let result;
  do {
    await waitForLoginTab(tabId);
    try {
      result = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
      if (result?.message?.includes("No content-script handler is registered for action")) {
        result = { ok: false, retryable: true };
      }
      if (!result?.retryable) return result;
    } catch (error) {
      // The link click can replace the document after the load check.
      if (!/Receiving end does not exist|frame.*removed|document.*unloaded|execution context.*destroyed/i.test(error.message)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  return { ok: false, message: "My Tenders took too long to load. Please try again." };
}

export async function automateTender(message) {
  const loginResult = await loginCustomer(message);
  if (!loginResult?.ok || !loginResult.submitted) return loginResult;
  try {
    await waitForLoginTab(loginResult.tabId);
    const opened = await sendTenderMessage(loginResult.tabId, {
      action: "openTenders", expectedOrigin: SITE_ORIGIN,
    });
    if (!opened?.ok) {
      return { ok: false, loginResult, message: opened?.message || "Could not click My Tenders." };
    }
    return { ok: true, loginResult, message: "My Tenders opened." };
  } catch (error) {
    return { ok: false, loginResult, message: error.message || "Could not open My Tenders." };
  }
}
