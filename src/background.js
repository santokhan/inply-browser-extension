import { CUSTOMER_LOGIN_ACTION, loginCustomer } from "./utils/customerLogin";

// Open the extension's side panel when its toolbar button is clicked.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== CUSTOMER_LOGIN_ACTION) return false;
  // Only the extension UI may start a login with customer credentials.
  if (sender.id !== chrome.runtime.id || sender.tab || !sender.url?.startsWith(chrome.runtime.getURL(""))) {
    sendResponse({ ok: false, message: "Customer login must be started from the extension." });
    return false;
  }
  loginCustomer(message).then(sendResponse).catch(() => {
    sendResponse({ ok: false, message: "Could not complete the login action. Check the eProcure tab and try again." });
  });
  return true;
});
