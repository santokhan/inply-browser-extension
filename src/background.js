import { CUSTOMER_LOGIN_ACTION, CUSTOMER_LOGOUT_ACTION, collectSignedInCustomerProfile, loginCustomer, logoutCustomer } from "./utils/customerLogin";
import { COLLECT_CUSTOMER_PROFILE_ACTION } from "./utils/customerProfile";

// Open the extension's side panel when its toolbar button is clicked.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (![CUSTOMER_LOGIN_ACTION, CUSTOMER_LOGOUT_ACTION, COLLECT_CUSTOMER_PROFILE_ACTION].includes(message?.action)) return false;
  // Only the extension UI may start a login with customer credentials.
  if (sender.id !== chrome.runtime.id || sender.tab || !sender.url?.startsWith(chrome.runtime.getURL(""))) {
    sendResponse({ ok: false, message: "Customer login and logout must be started from the extension." });
    return false;
  }
  const operations = {
    [CUSTOMER_LOGIN_ACTION]: () => loginCustomer(message),
    [CUSTOMER_LOGOUT_ACTION]: () => logoutCustomer(),
    [COLLECT_CUSTOMER_PROFILE_ACTION]: () => collectSignedInCustomerProfile(message),
  };
  const operation = operations[message.action]();
  operation.then(sendResponse).catch((error) => {
    sendResponse({ ok: false, message: error.message || "Could not complete the customer action. Check the eProcure tab and try again." });
  });
  return true;
});
