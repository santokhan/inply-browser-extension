import { ACTIVE_CUSTOMER_KEY } from "../utils/extensionCustomer.js";
import { resolveCustomerLogout } from "../content/customerLogout.js";
import { SITE_ORIGIN, isSiteUrl } from "../config/site.js";

export async function confirmCustomerLoggedOut(sender, isActionPending) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !isSiteUrl(sender.url) || isActionPending()) return;
  const stored = (await chrome.storage.local.get(ACTIVE_CUSTOMER_KEY))[ACTIVE_CUSTOMER_KEY];
  // Old login tabs share storage, but cannot invalidate the selected customer's tab.
  if (!stored || !Number.isInteger(stored.profileTabId) || stored.profileTabId !== sender.tab?.id) return;
  const results = await chrome.scripting.executeScript({
    target: { tabId: stored.profileTabId, frameIds: [0] },
    func: resolveCustomerLogout,
    args: ["inspectCustomerSession", SITE_ORIGIN],
  });
  const session = results[0]?.result;
  if (!session?.ok || session.hasLogoutControl || !session.loginForm || isActionPending()) return;
  const current = (await chrome.storage.local.get(ACTIVE_CUSTOMER_KEY))[ACTIVE_CUSTOMER_KEY];
  if (!isActionPending() && JSON.stringify(current) === JSON.stringify(stored)) {
    await chrome.storage.local.remove(ACTIVE_CUSTOMER_KEY);
  }
}
