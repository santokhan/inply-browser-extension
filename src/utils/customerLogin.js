export const CUSTOMER_LOGIN_ACTION = "loginCustomer";
export const EPROCURE_URL = "https://www.eprocure.gov.bd/";

// Inspect the page without sending customer credentials into an active session.
export function findCustomerLogout() {
  if (window.location.origin !== "https://www.eprocure.gov.bd") {
    return { ok: false, message: "Login stopped because the page left eProcure." };
  }
  const link = [...document.querySelectorAll("a[href]")].find((anchor) => {
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin && url.pathname === "/Logout.jsp" &&
      anchor.getClientRects().length > 0;
  });
  return { ok: true, logoutUrl: link ? new URL(link.href, window.location.href).href : null };
}

export async function getCustomerSession() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("No active browser tab.");
  if (!tab.url?.startsWith(EPROCURE_URL)) return { loggedIn: false };
  if (tab.status === "loading") throw new Error("eProcure is loading.");
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: findCustomerLogout,
  });
  const result = results[0]?.result;
  if (!result?.ok) throw new Error("Could not check the eProcure session.");
  return { loggedIn: Boolean(result.logoutUrl) };
}

// This function is serialized by executeScript, so keep it self-contained.
export function submitCustomerLogin(email, password) {
  if (window.location.origin !== "https://www.eprocure.gov.bd") {
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
    return { ok: true, message: "Credentials filled. Complete the verification in the eProcure tab, then click Login." };
  }

  // Click the site's control to preserve its validation and login handlers.
  button.click();
  return { ok: true, message: "Login submitted. Check the eProcure tab for the result." };
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

export async function loginCustomer({ email, password }) {
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    throw new Error("Save an email and password for this customer before logging in.");
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    throw new Error("Select a browser tab before starting customer login.");
  }
  const navigate = async (url) => {
    await chrome.tabs.update(tab.id, { url });
    await waitForLoginTab(tab.id);
  };
  const inspectSession = async () => {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: findCustomerLogout,
    });
    const result = results[0]?.result;
    if (!result?.ok) throw new Error(result?.message || "Could not check the eProcure session.");
    return result;
  };

  if (!tab.url?.startsWith(EPROCURE_URL)) await navigate(EPROCURE_URL);
  await waitForLoginTab(tab.id);
  const session = await inspectSession();
  if (session.logoutUrl) {
    return { ok: true, message: "Already logged in to eProcure. Log out first to sign in as another customer." };
  }
  // The login form lives on the home page. Recheck after navigation in case
  // another tab has established a shared session in the meantime.
  await navigate(EPROCURE_URL);
  const refreshedSession = await inspectSession();
  if (refreshedSession.logoutUrl) {
    return { ok: true, message: "Already logged in to eProcure. Log out first to sign in as another customer." };
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: submitCustomerLogin,
    args: [email.trim(), password],
  });
  return results[0]?.result || { ok: false, message: "Could not fill the eProcure login form. Please try again." };
}
