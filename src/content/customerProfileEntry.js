import { handleCustomerProfileRequest } from "./customerProfile.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["openViewProfilePage", "openCompanyDetailsTaba", "readCustomerProfile", "openBankDetailsTab", "readCustomerBankDetails"].includes(message?.action)) return false;
  // Service-worker messages can omit url. The extension ID and absence of a
  // sender tab identify our background worker as well as extension UI pages.
  if (sender.id !== chrome.runtime.id || sender.tab
    || (sender.url && !sender.url.startsWith(chrome.runtime.getURL("")))) return false;
  handleCustomerProfileRequest(message.action).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, message: error.message });
  });
  return true;
});
