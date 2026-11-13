import { resolveCustomerLogout } from "./customerLogout.js";
import { ACTIVE_CUSTOMER_KEY } from "../utils/extensionCustomer.js";

export function installCustomerSessionMonitor() {
  if (window.location.origin !== "https://www.eprocure.gov.bd" || window.top !== window) return;

  let timer;
  const checkSession = async () => {
    try {
      const stored = await chrome.storage.local.get(ACTIVE_CUSTOMER_KEY);
      if (!stored[ACTIVE_CUSTOMER_KEY] || document.readyState !== "complete") return;
      if (!resolveCustomerLogout().hasLogoutControl) {
        await chrome.storage.local.remove(ACTIVE_CUSTOMER_KEY);
      }
    } catch (error) {
      console.warn("Could not synchronize the eProcure customer session:", error);
    }
  };
  // Let page rendering settle before treating a missing Logout link as logout.
  const scheduleCheck = () => {
    clearTimeout(timer);
    timer = setTimeout(checkSession, 500);
  };
  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href", "aria-label", "value"],
  });
  window.addEventListener("load", scheduleCheck, { once: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[ACTIVE_CUSTOMER_KEY]?.newValue) scheduleCheck();
  });
  scheduleCheck();
}
