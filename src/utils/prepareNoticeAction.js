import { SITE_ORIGIN } from "../config/site.js";
import { prepareNoticePageAction } from "../content/prepareNotice.js";

export async function clickAllTendersLink(tabId) {
  const message = { action: "prepareNotice", task: "openAllTenders", expectedOrigin: SITE_ORIGIN };
  try {
    const result = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
    if (typeof result?.ok === "boolean") return result;
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) throw error;
  }

  // Install the feature listener in tabs that were already open during reload.
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: prepareNoticePageAction,
    args: ["install"],
  });
  return chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
}
