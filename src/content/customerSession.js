import { resolveCustomerLogout } from "./customerLogout.js";
import { ACTIVE_CUSTOMER_KEY } from "../utils/extensionCustomer.js";

export function installCustomerSessionMonitor() {
  if (window.location.origin !== "https://www.eprocure.gov.bd" || window.top !== window) return;

  let timer;
  let loggedOutChecks = 0;
  const checkSession = async () => {
    try {
      const stored = await chrome.storage.local.get(ACTIVE_CUSTOMER_KEY);
      if (!stored[ACTIVE_CUSTOMER_KEY] || document.readyState !== "complete") {
        loggedOutChecks = 0;
        return;
      }
      const session = resolveCustomerLogout();
      if (session.hasLogoutControl || !session.loginForm) {
        loggedOutChecks = 0;
        return;
      }
      // A missing menu is ambiguous. Require the login form on two checks.
      if (++loggedOutChecks < 2) {
        timer = setTimeout(checkSession, 1500);
        return;
      }
      await chrome.runtime.sendMessage({ action: "confirmCustomerLoggedOut" });
    } catch (error) {
      console.warn("Could not synchronize the eProcure customer session:", error);
    }
  };
  // Let page rendering settle before checking for a logged-out page.
  const scheduleCheck = () => {
    clearTimeout(timer);
    timer = setTimeout(checkSession, 1500);
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
    if (area === "local" && changes[ACTIVE_CUSTOMER_KEY]) {
      loggedOutChecks = 0;
      scheduleCheck();
    }
  });
  scheduleCheck();
}
