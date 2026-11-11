import { isSiteUrl } from "../config/site.js";

export async function collectCustomerProfile(tabId, { inspectSession, timeout = 120000 }) {
  const deadline = Date.now() + timeout;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && !isSiteUrl(tab.url)) {
      throw new Error("Profile collection stopped because the tab left eProcure.");
    }
    if (tab.status === "complete") {
      try { loggedIn = Boolean((await inspectSession()).hasLogoutControl); } catch { /* Navigation may replace the document during inspection. */ }
      if (loggedIn) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!loggedIn) throw new Error("Complete eProcure login to collect the missing business details.");
  const request = async (action) => {
    // A completed tab can precede document_idle registration of its content script.
    while (Date.now() < deadline) {
      const tab = await chrome.tabs.get(tabId);
      if (!isSiteUrl(tab.url)) {
        throw new Error("Profile collection stopped because the tab left eProcure.");
      }
      let response;
      try { response = await chrome.tabs.sendMessage(tabId, { action }, { frameId: 0 }); }
      catch { await new Promise((resolve) => setTimeout(resolve, 100)); continue; }
      if (!response?.ok) throw new Error(response?.message || "Could not collect customer profile details.");
      return response;
    }
    throw new Error("eProcure took too long to collect business details.");
  };
  for (const [action, path] of [
    ["openViewProfilePage", "/tenderer/ViewRegistrationDetail.jsp"],
    ["openCompanyDetailsTaba", "/tenderer/ViewCompanyDetail.jsp"],
  ]) {
    const { url } = await request(action);
    const destination = new URL(url);
    if (!isSiteUrl(destination.href) || destination.pathname !== path) {
      throw new Error("The profile link does not point to the expected eProcure page.");
    }
    // Navigation is initiated by the content script after its response is sent.
    let arrived = false;
    while (Date.now() < deadline) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !isSiteUrl(tab.url)) {
        throw new Error("Profile collection stopped because the tab left eProcure.");
      }
      if (tab.status === "complete" && tab.url === url) { arrived = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!arrived) throw new Error("eProcure took too long to open the profile page.");
  }
  return (await request("readCustomerProfile")).profile;
}
