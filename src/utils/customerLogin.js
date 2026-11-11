import { SITE_ORIGIN, SITE_URL, isSiteUrl } from "../config/site.js";
import { collectCustomerProfile } from "../background/customerProfile.js";
import { resolveCustomerLogout } from "../content/customerLogout.js";

export const CUSTOMER_LOGIN_ACTION = "loginCustomer";
export const CUSTOMER_LOGOUT_ACTION = "signOutCustomer";
export const EPROCURE_URL = SITE_URL;

async function inspectCustomerLogout(tabId, action = "inspectCustomerSession") {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: resolveCustomerLogout,
    args: [action, SITE_ORIGIN],
  });
  const result = results[0]?.result;
  if (!result?.ok) throw new Error(result?.message || "Could not run the customer logout script on eProcure.");
  return result;
}

async function logoutCustomerTab(tabId) {
  const session = await inspectCustomerLogout(tabId);
  if (!session.hasLogoutControl) return false;
  await inspectCustomerLogout(tabId, "logoutCustomer");
  // Navigation can return before loading begins. Wait for Logout to disappear
  // before opening the login tab so shared cookies have time to be cleared.
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && !isSiteUrl(tab.url)) throw new Error("Logout stopped because the page left eProcure.");
    if (tab.status === "complete") {
      try {
        const result = await inspectCustomerLogout(tabId);
        if (!result.hasLogoutControl && result.loginForm) return true;
      } catch { /* The document may be replaced while logout navigates. */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("eProcure did not finish logging out. Please try Login again.");
}

export async function logoutCustomer() {
  const tabs = await chrome.tabs.query({ url: `${SITE_ORIGIN}/*` });
  if (tabs.length === 0) {
    const tab = await chrome.tabs.create({ url: EPROCURE_URL, active: true });
    if (!tab?.id) throw new Error("Could not open eProcure to log out.");
    tabs.push(tab);
  }
  tabs.sort((first, second) => Number(Boolean(second.active)) - Number(Boolean(first.active)));
  for (const tab of tabs) {
    await waitForLoginTab(tab.id);
    if (await logoutCustomerTab(tab.id)) return { ok: true };
    if ((await inspectCustomerLogout(tab.id)).loginForm) return { ok: true };
  }
  throw new Error("Could not find the eProcure Logout control or login form in the open tabs.");
}

// This function is serialized by executeScript, so keep it self-contained.
export function submitCustomerLogin(email, password, expectedOrigin) {
  if (window.location.origin !== expectedOrigin) {
    return { ok: false, message: "Login stopped because the page left eProcure." };
  }

  const form = document.querySelector('form#frmLogin');
  const emailInput = form?.querySelector('input[name="emailId"]');
  const passwordInput = form?.querySelector('input[name="password"]');
  const button = form?.querySelector('input[name="Login"], button[type="submit"]');
  if (!form || !emailInput || !passwordInput || !button || button.disabled) {
    return { ok: false, message: "The eProcure login form is unavailable. Check the opened tab, including any existing signed-in session." };
  }
  if (new URL(form.action, window.location.href).origin !== window.location.origin) {
    return { ok: false, message: "Login stopped because the form does not submit to eProcure." };
  }

  for (const [input, value] of [[emailInput, email], [passwordInput, password]]) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const challenge = [...form.querySelectorAll('input:not([type="hidden"]), iframe')].find((element) => {
    const description = `${element.id} ${element.name} ${element.getAttribute("src") || ""}`;
    return /captcha|verification|otp/i.test(description) && element.getClientRects().length > 0;
  });
  if (challenge) {
    challenge.focus();
    return { ok: true, submitted: true, message: "Credentials filled. Complete the verification in the eProcure tab, then click Login." };
  }

  // Click the site's control to preserve its validation and login handlers.
  button.click();
  return { ok: true, submitted: true, message: "Login submitted. Check the eProcure tab for the result." };
}

export function waitForLoginTab(tabId, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    };
    const finish = () => { cleanup(); resolve(); };
    const fail = (message) => { cleanup(); reject(new Error(message)); };
    const onUpdated = (id, change) => {
      if (id === tabId && change.status === "complete") finish();
    };
    const onRemoved = (id) => {
      if (id === tabId) fail("The eProcure tab was closed before login.");
    };
    const timer = setTimeout(() => fail("eProcure took too long to load. Please try Login again."), timeout);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    // Check after registering listeners so a fast page load cannot be missed.
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch(() => fail("Could not access the eProcure tab."));
  });
}

export async function loginCustomer({ email, password, collectProfile = false }) {
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    throw new Error("Save an email and password for this customer before logging in.");
  }
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab?.id) {
    throw new Error("Select a browser tab before starting customer login.");
  }
  if (isSiteUrl(activeTab.url)) {
    await waitForLoginTab(activeTab.id);
    await logoutCustomerTab(activeTab.id);
  }
  const tab = await chrome.tabs.create({ url: EPROCURE_URL, active: true });
  if (!tab?.id) throw new Error("Could not open the eProcure login tab.");
  await waitForLoginTab(tab.id);
  // Also handles starting from an unrelated tab with shared eProcure cookies.
  if (await logoutCustomerTab(tab.id)) {
    await chrome.tabs.update(tab.id, { url: EPROCURE_URL });
    await waitForLoginTab(tab.id);
  }
  const inspectSession = () => inspectCustomerLogout(tab.id);
  if ((await inspectSession()).hasLogoutControl) throw new Error("eProcure is still logged in. Please try Login again.");
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: submitCustomerLogin,
    args: [email.trim(), password, SITE_ORIGIN],
  });
  const result = results[0]?.result;
  if (result?.ok) {
    await chrome.storage.local.set({ encryptPassword: password });
    if (collectProfile) {
      try {
        const profile = await collectCustomerProfile(tab.id, {
          inspectSession,
        });
        return { ...result, profile, message: "Logged in. Business details collected from Company Details." };
      } catch (error) {
        return { ...result, message: `${result.message} ${error.message}` };
      }
    }
  }
  return result || { ok: false, message: "Could not fill the eProcure login form. Please try again." };
}
