import { handleCustomerProfileRequest } from "./customerProfile.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["openViewProfilePage", "openCompanyDetailsTaba", "readCustomerProfile"].includes(message?.action)) return false;
  if (sender.id !== chrome.runtime.id || sender.tab || !sender.url?.startsWith(chrome.runtime.getURL(""))) return false;
  handleCustomerProfileRequest(message.action).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, message: error.message });
  });
  return true;
});
