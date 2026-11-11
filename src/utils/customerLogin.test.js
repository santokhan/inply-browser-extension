import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { findCustomerLogout, getCustomerSession, loginCustomer, submitCustomerLogin, waitForLoginTab } from "./customerLogin.js";
import { findCustomerCompanyLink, findCustomerProfileLink, readCustomerProfile } from "./customerProfile.js";

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
  const stored = { encryptPassword: "previous-password" };
  const updated = new Set();
  const removed = new Set();
  const event = (listeners) => ({ addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) });
  globalThis.chrome = {
    storage: { local: { set: async (values) => { Object.assign(stored, values); } } },
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
  return { updated, removed, stored };
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
  assert.equal(events.stored.encryptPassword, " exact password ");
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
  const { stored } = browser();
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/Dashboard.jsp" }];
  document.querySelectorAll = () => [{ href: "/Logout.jsp", getClientRects: () => [1] }];
  chrome.tabs.update = async () => { assert.fail("An active session must be left alone."); };
  const result = await loginCustomer({ email: "customer@example.com", password: "secret" });
  assert.equal(result.ok, true);
  assert.match(result.message, /Already logged in/);
  assert.equal(page.email.savedValue, undefined);
  assert.equal(page.password.savedValue, undefined);
  assert.equal(page.button.clicks, 0);
  assert.equal(stored.encryptPassword, "previous-password");
});

test("keeps the saved password when the login form is unavailable", async () => {
  loginPage({ missing: true });
  const { stored } = browser();
  const result = await loginCustomer({ email: "customer@example.com", password: "secret" });
  assert.equal(result.ok, false);
  assert.equal(stored.encryptPassword, "previous-password");
});

test("saves the selected customer's password when login awaits manual verification", async () => {
  loginPage({ challenge: true });
  const { stored } = browser();
  const result = await loginCustomer({ email: "customer@example.com", password: "customer-password" });
  assert.equal(result.ok, true);
  assert.match(result.message, /Complete the verification/);
  assert.equal(stored.encryptPassword, "customer-password");
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

test("collects profile details only after this customer's login establishes a session", async () => {
  loginPage();
  browser();
  const calls = [];
  let loggedIn = false;
  chrome.scripting.executeScript = async ({ func }) => {
    calls.push(func);
    if (func === findCustomerLogout) return [{ result: { ok: true, logoutUrl: loggedIn ? "/Logout.jsp" : null } }];
    if (func === submitCustomerLogin) {
      loggedIn = true;
      return [{ result: { ok: true, message: "Login submitted." } }];
    }
    if (func === findCustomerProfileLink) return [{ result: "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=selected" }];
    if (func === findCustomerCompanyLink) return [{ result: "https://www.eprocure.gov.bd/tenderer/ViewCompanyDetail.jsp?uId=selected&tId=tenderer&cId=company" }];
    if (func === readCustomerProfile) return [{ result: { businessName: "Selected Co", registeredAddress: "Dhaka" } }];
    assert.fail("Unexpected injection");
  };
  const destinations = [];
  chrome.tabs.update = async (id, { url }) => { destinations.push(url); };
  const result = await loginCustomer({ email: "customer@example.com", password: "secret", collectProfile: true });
  assert.deepEqual(result.profile, { businessName: "Selected Co", registeredAddress: "Dhaka" });
  assert.deepEqual(destinations.slice(-2), [
    "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=selected",
    "https://www.eprocure.gov.bd/tenderer/ViewCompanyDetail.jsp?uId=selected&tId=tenderer&cId=company",
  ]);
  assert.ok(calls.indexOf(submitCustomerLogin) < calls.indexOf(findCustomerProfileLink));
});

test("does not collect another customer's profile from an existing signed-in session", async () => {
  loginPage();
  browser();
  document.querySelectorAll = () => [{ href: "/Logout.jsp", getClientRects: () => [1] }];
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/Dashboard.jsp" }];
  chrome.tabs.update = async () => { assert.fail("Existing sessions must not be navigated for profile collection"); };
  const result = await loginCustomer({ email: "another@example.com", password: "secret", collectProfile: true });
  assert.match(result.message, /Already logged in/);
  assert.equal(result.profile, undefined);
});
