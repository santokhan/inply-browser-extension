import { CUSTOMER_LOGIN_ACTION, CUSTOMER_LOGOUT_ACTION, collectSignedInCustomerProfile, loginCustomer, logoutCustomer } from "./utils/customerLogin";
import { COLLECT_CUSTOMER_PROFILE_ACTION } from "./utils/customerProfile";
import { AUTOMATE_TENDER_ACTION } from "./utils/tenderBasket.js";
import { automateTender } from "./background/tenderBasket.js";

let customerActionPending = false;

// Open the extension's side panel when its toolbar button is clicked.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (![CUSTOMER_LOGIN_ACTION, CUSTOMER_LOGOUT_ACTION, COLLECT_CUSTOMER_PROFILE_ACTION, AUTOMATE_TENDER_ACTION].includes(message?.action)) return false;
  // Only the extension UI may start a login with customer credentials.
  if (sender.id !== chrome.runtime.id || sender.tab || !sender.url?.startsWith(chrome.runtime.getURL(""))) {
    sendResponse({ ok: false, message: "Customer login and logout must be started from the extension." });
    return false;
  }
  if (customerActionPending) {
    sendResponse({ ok: false, message: "Wait for the current customer action to finish." });
    return false;
  }
  customerActionPending = true;
  const operations = {
    [AUTOMATE_TENDER_ACTION]: () => automateTender(message),
    [CUSTOMER_LOGIN_ACTION]: () => loginCustomer(message),
    [CUSTOMER_LOGOUT_ACTION]: () => logoutCustomer(),
    [COLLECT_CUSTOMER_PROFILE_ACTION]: () => collectSignedInCustomerProfile(message),
  };
  const operation = operations[message.action]();
  operation.then(sendResponse).catch((error) => {
    sendResponse({ ok: false, message: error.message || "Could not complete the customer action. Check the eProcure tab and try again." });
  }).finally(() => { customerActionPending = false; });
  return true;
});
