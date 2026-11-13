import { SITE_ORIGIN } from "../config/site.js";
import { normalizeTenderId } from "./tenderBasket.js";
import { tenderPageAction } from "../content/tender.js";

async function sendTenderMessage(tabId, message) {
  const send = () => chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
  try {
    const result = await send();
    if (typeof result?.ok === "boolean"
      && !result.message?.includes("No content-script handler is registered for action")) return result;
  } catch (error) {
    if (!error.message?.includes("Receiving end does not exist")) throw error;
  }

  // Existing tabs may predate installation or an extension reload.
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: tenderPageAction,
    args: ["install"],
  });
  const deadline = Date.now() + 5000;
  do {
    try {
      const result = await send();
      if (typeof result?.ok === "boolean") return result;
    } catch (error) {
      if (!error.message?.includes("Receiving end does not exist")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error("Could not connect to My Tenders. Reload the eProcure tab and try again.");
}

export function openMyTenders(tabId) {
  return sendTenderMessage(tabId, { action: "openTenders", expectedOrigin: SITE_ORIGIN });
}

export async function searchMyTender(tabId, tenderId) {
  const message = { action: "searchTender", tenderId: normalizeTenderId(tenderId), expectedOrigin: SITE_ORIGIN };
  const deadline = Date.now() + 30000;
  do {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && new URL(tab.url).origin !== SITE_ORIGIN) {
      throw new Error("The tender page left eProcure.");
    }
    if (tab.status === "complete") {
      try {
        const result = await sendTenderMessage(tabId, message);
        if (!result?.retryable) return result;
      } catch (error) {
        // My Tenders navigation may replace the document during a message.
        if (!/frame.*removed|document.*unloaded|message port closed|message channel closed/i.test(error.message)) throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  throw new Error("My Tenders took too long to load its search controls. Please try again.");
}
