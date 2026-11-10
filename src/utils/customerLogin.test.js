import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { findCustomerLogout, getCustomerSession, loginCustomer, submitCustomerLogin, waitForLoginTab } from "./customerLogin.js";

afterEach(() => {
  for (const key of ["chrome", "window", "document", "HTMLInputElement"]) delete globalThis[key];
});

function loginPage({ origin = "https://www.eprocure.gov.bd", action = "/LoginSrBean?action=checkLogin", challenge = false, missing = false } = {}) {
  class Input {
    events = [];
    set value(value) { this.savedValue = value; }
    dispatchEvent(event) { this.events.push(event.type); }
  }
  globalThis.HTMLInputElement = Input;
  globalThis.window = { location: { origin, href: `${origin}/` } };
  const email = new Input();
  const password = new Input();
  const button = { clicks: 0, click() { this.clicks++; } };
  const captcha = { id: "captcha", name: "captcha", getAttribute: () => null, getClientRects: () => [1], focus() { this.focused = true; } };
  const form = {
    action,
    querySelector: (selector) => selector.includes("emailId") ? email : selector.includes("password") ? password : button,
    querySelectorAll: () => challenge ? [captcha] : [],
  };
  globalThis.document = { querySelector: () => missing ? null : form, querySelectorAll: () => [] };
  return { email, password, button, captcha };
}

function browser() {
  const updated = new Set();
  const removed = new Set();
  const event = (listeners) => ({ addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) });
  globalThis.chrome = {
    tabs: {
      create: async () => { assert.fail("Customer login must reuse the active tab."); },
      query: async (options) => {
        assert.deepEqual(options, { active: true, lastFocusedWindow: true });
        return [{ id: 7 }];
      },
      update: async (tabId, options) => {
        assert.equal(tabId, 7);
        assert.deepEqual(options, { url: "https://www.eprocure.gov.bd/" });
        return { id: tabId };
      },
      get: async () => ({ status: "complete" }),
      onUpdated: event(updated),
      onRemoved: event(removed),
    },
    scripting: { executeScript: async ({ target, func, args }) => {
      assert.equal(target.tabId, 7);
      return [{ result: func(...(args || [])) }];
    } },
  };
  return { updated, removed };
}

test("reuses the active tab for eProcure, fills the selected credentials, and clicks login once", async () => {
  const page = loginPage();
  const events = browser();
  const result = await loginCustomer({ email: " customer@example.com ", password: " exact password " });
  assert.equal(result.ok, true);
  assert.equal(page.email.savedValue, "customer@example.com");
  assert.equal(page.password.savedValue, " exact password ");
  assert.deepEqual(page.password.events, ["input", "change"]);
  assert.equal(page.button.clicks, 1);
  assert.equal(events.updated.size + events.removed.size, 0);
});

test("does not disclose credentials after a redirect or a changed form destination", () => {
  for (const options of [{ origin: "https://example.com" }, { action: "https://example.com/login" }]) {
    const page = loginPage(options);
    assert.equal(submitCustomerLogin("customer@example.com", "secret").ok, false);
    assert.equal(page.email.savedValue, undefined);
    assert.equal(page.password.savedValue, undefined);
    assert.equal(page.button.clicks, 0);
  }
});

test("recognizes the provided Logout.jsp link and ignores foreign or hidden links", () => {
  loginPage();
  const link = (href, visible = true) => ({ href, getClientRects: () => visible ? [1] : [] });
  document.querySelectorAll = () => [link("https://example.com/Logout.jsp"), link("/Logout.jsp", false)];
  assert.equal(findCustomerLogout().logoutUrl, null);
  document.querySelectorAll = () => [link("/Logout.jsp")];
  assert.equal(findCustomerLogout().logoutUrl, "https://www.eprocure.gov.bd/Logout.jsp");
});

test("reports login visibility from the current eProcure page without navigating", async () => {
  loginPage();
  browser();
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/Dashboard.jsp", status: "complete" }];
  chrome.tabs.update = async () => { assert.fail("Session checks must not navigate."); };
  document.querySelectorAll = () => [{ href: "/Logout.jsp", getClientRects: () => [1] }];
  assert.deepEqual(await getCustomerSession(), { loggedIn: true });
  document.querySelectorAll = () => [];
  assert.deepEqual(await getCustomerSession(), { loggedIn: false });
});

test("does not report logged out while the eProcure tab is loading or inspection fails", async () => {
  browser();
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/", status: "loading" }];
  await assert.rejects(getCustomerSession(), /loading/);
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/", status: "complete" }];
  chrome.scripting.executeScript = async () => [];
  await assert.rejects(getCustomerSession(), /Could not check/);
});

test("preserves the existing session without navigating or sending credentials", async () => {
  const page = loginPage();
  browser();
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/Dashboard.jsp" }];
  document.querySelectorAll = () => [{ href: "/Logout.jsp", getClientRects: () => [1] }];
  chrome.tabs.update = async () => { assert.fail("An active session must be left alone."); };
  const result = await loginCustomer({ email: "customer@example.com", password: "secret" });
  assert.equal(result.ok, true);
  assert.match(result.message, /Already logged in/);
  assert.equal(page.email.savedValue, undefined);
  assert.equal(page.password.savedValue, undefined);
  assert.equal(page.button.clicks, 0);
});

test("skips login if a shared session appears after navigating to the home page", async () => {
  const page = loginPage();
  browser();
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/Dashboard.jsp" }];
  let loggedIn = false;
  document.querySelectorAll = () => loggedIn ? [{ href: "/Logout.jsp", getClientRects: () => [1] }] : [];
  chrome.tabs.update = async (id, { url }) => {
    assert.equal(url, "https://www.eprocure.gov.bd/");
    loggedIn = true;
    return { id };
  };
  const result = await loginCustomer({ email: "customer@example.com", password: "secret" });
  assert.equal(result.ok, true);
  assert.match(result.message, /Already logged in/);
  assert.equal(page.password.savedValue, undefined);
  assert.equal(page.button.clicks, 0);
});

test("leaves a visible verification challenge for the user", () => {
  const page = loginPage({ challenge: true });
  const result = submitCustomerLogin("customer@example.com", "secret");
  assert.equal(result.ok, true);
  assert.match(result.message, /Complete the verification/);
  assert.equal(page.password.savedValue, "secret");
  assert.equal(page.captcha.focused, true);
  assert.equal(page.button.clicks, 0);
});

test("reports an unavailable login form", () => {
  loginPage({ missing: true });
  assert.equal(submitCustomerLogin("customer@example.com", "secret").ok, false);
});

test("rejects missing credentials before navigating a tab", async () => {
  await assert.rejects(loginCustomer({ email: "", password: "secret" }), /Save an email and password/);
});

test("does not create a tab when there is no active tab", async () => {
  browser();
  chrome.tabs.query = async () => [];
  chrome.tabs.update = async () => { assert.fail("No tab should be navigated."); };
  await assert.rejects(loginCustomer({ email: "customer@example.com", password: "secret" }), /Select a browser tab/);
});

test("cleans up listeners on page timeout and tab closure", async () => {
  const events = browser();
  chrome.tabs.get = async () => ({ status: "loading" });
  await assert.rejects(waitForLoginTab(7, 5), /too long/);
  assert.equal(events.updated.size + events.removed.size, 0);
  const pending = waitForLoginTab(7);
  for (const listener of events.removed) listener(7);
  await assert.rejects(pending, /closed/);
  assert.equal(events.updated.size + events.removed.size, 0);
});
