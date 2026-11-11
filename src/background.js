import { CUSTOMER_LOGIN_ACTION, CUSTOMER_LOGOUT_ACTION, loginCustomer, logoutCustomer } from "./utils/customerLogin";

// Open the extension's side panel when its toolbar button is clicked.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (![CUSTOMER_LOGIN_ACTION, CUSTOMER_LOGOUT_ACTION].includes(message?.action)) return false;
  // Only the extension UI may start a login with customer credentials.
  if (sender.id !== chrome.runtime.id || sender.tab || !sender.url?.startsWith(chrome.runtime.getURL(""))) {
    sendResponse({ ok: false, message: "Customer login and logout must be started from the extension." });
    return false;
  }
  const operation = message.action === CUSTOMER_LOGOUT_ACTION ? logoutCustomer() : loginCustomer(message);
  operation.then(sendResponse).catch((error) => {
    sendResponse({ ok: false, message: error.message || "Could not complete the customer action. Check the eProcure tab and try again." });
  });
  return true;
});
