import { openAllTenders } from "../content/prepareNotice.js";
import { getActiveTabSafe } from "./chrome.js";
import { isSiteUrl } from "../config/site.js";

export async function clickAllTendersLink(tabId, filters) {
  const [execution] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: openAllTenders,
    args: [filters],
  });
  return execution?.result ?? { ok: false, message: "Could not open All Tenders." };
}

function setNoticeFilterOnPage(field, value) {
  if (!window.location.pathname.endsWith("/AllTenders.jsp")) {
    return { ok: false, message: "The All Tenders search form is not open." };
  }

  const selectors = {
    procurementType: "#cmbType",
    procurementMethod: "#cmbProcMethod",
    procurementNature: "#procNature",
  };
  const element = document.querySelector(selectors[field]);
  if (!element) return { ok: false, message: "The eGP search field is not available." };

  element.value = String(value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true };
}

export async function syncNoticeFilter(field, value) {
  const tab = await getActiveTabSafe();
  if (!tab?.id || !isSiteUrl(tab.url) || tab.status !== "complete") return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [0] },
    func: setNoticeFilterOnPage,
    args: [field, value],
  });
}
