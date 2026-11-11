import { SITE_ORIGIN, isSiteUrl } from "../config/site.js";

// Serialized into the isolated world, alongside the profile content script.
async function runProfileRequest(action, expectedOrigin) {
  if (window.location.origin !== expectedOrigin) {
    throw new Error("Profile collection stopped because the tab left eProcure.");
  }
  if (!window.InplyCustomerProfile) return { available: false };
  return { available: true, response: await window.InplyCustomerProfile.handleRequest(action) };
}

async function recoverProfileRequest(tabId, action, deadline) {
  let injected = false;
  while (Date.now() < deadline) {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: runProfileRequest,
      args: [action, SITE_ORIGIN],
    });
    const result = results[0]?.result;
    if (result?.available) return result.response;
    if (!injected) {
      const files = chrome.runtime.getManifest().content_scripts
        .flatMap((entry) => entry.js || [])
        .filter((file) => file.includes("customerProfileEntry.js"));
      if (!files.length) throw new Error("The profile collection script is missing. Reload the extension and try again.");
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files });
      injected = true;
    }
    // Production content-script loaders import their module asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`eProcure took too long to connect for ${action}. Try collecting again.`);
}

export async function collectCustomerProfile(tabId, { inspectSession, timeout = 120000, fields = ["businessName", "registeredAddress"] }) {
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
      catch { response = null; }
      if (typeof response?.ok !== "boolean" || response?.message?.includes("No content-script handler is registered for action")) {
        response = await recoverProfileRequest(tabId, action, deadline);
      }
      if (!response?.ok) throw new Error(response?.message || `eProcure returned an invalid response for ${action}. Try collecting again.`);
      return response;
    }
    throw new Error("eProcure took too long to collect business details.");
  };
  const navigate = async (action, path) => {
    const { url } = await request(action);
    const destination = new URL(url);
    const expectedPage = path ? destination.pathname === path : /^\/tenderer\/[^/]+\.jsp$/i.test(destination.pathname);
    if (!isSiteUrl(destination.href) || !expectedPage) {
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
  };
  const profile = {};
  const errors = [];
  try {
    await navigate("openViewProfilePage", "/tenderer/ViewRegistrationDetail.jsp");
    const collectCompany = fields.some((field) => ["businessName", "registeredAddress"].includes(field));
    if (collectCompany) {
      try {
        await navigate("openCompanyDetailsTaba", "/tenderer/ViewCompanyDetail.jsp");
        Object.assign(profile, (await request("readCustomerProfile")).profile);
      } catch (error) {
        errors.push(error.message);
      }
    }
    if (fields.some((field) => ["bankName", "branchName"].includes(field))) {
      try {
        await navigate("openBankDetailsTab");
        Object.assign(profile, (await request("readCustomerBankDetails")).profile);
      } catch (error) {
        errors.push(error.message);
      }
    }
    if (errors.length) throw new Error(errors.join(" "));
    return profile;
  } catch (error) {
    error.profile = profile;
    throw error;
  }
}
