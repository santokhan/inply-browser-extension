import { SITE_ORIGIN } from "../config/site.js";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loginCustomer, logoutCustomer, submitCustomerLogin, waitForLoginTab } from "./customerLogin.js";
import { resolveCustomerLogout } from "../content/customerLogout.js";

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
  const created = [];
  const event = (listeners) => ({ addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) });
  globalThis.chrome = {
    storage: { local: { set: async (values) => { Object.assign(stored, values); } } },
    tabs: {
      create: async (options) => {
        assert.deepEqual(options, { url: "https://www.eprocure.gov.bd/", active: true });
        created.push(options);
        return { id: 8 };
      },
      query: async (options) => {
        assert.deepEqual(options, { active: true, lastFocusedWindow: true });
        return [{ id: 7, url: "https://www.eprocure.gov.bd/" }];
      },
      update: async (tabId, options) => {
        assert.equal(tabId, 8);
        assert.deepEqual(options, { url: "https://www.eprocure.gov.bd/" });
        return { id: tabId };
      },
      get: async () => ({ status: "complete" }),
      onUpdated: event(updated),
      onRemoved: event(removed),
    },
    scripting: { executeScript: async ({ target, func, args }) => {
      assert.ok([7, 8].includes(target.tabId));
      return [{ result: func(...(args || [])) }];
    } },
  };
  return { updated, removed, stored, created };
}

test("customer logout clicks the website control in an existing eProcure tab", async () => {
  loginPage();
  const events = browser();
  let signedIn = true;
  let clicks = 0;
  const control = { href: "/Logout.jsp", click() { clicks++; signedIn = false; } };
  document.querySelectorAll = () => signedIn ? [control] : [];
  chrome.tabs.query = async (options) => {
    assert.deepEqual(options, { url: `${SITE_ORIGIN}/*` });
    return [{ id: 7, active: true }];
  };
  assert.deepEqual(await logoutCustomer(), { ok: true });
  assert.equal(clicks, 1);
  assert.equal(events.created.length, 0);
});

test("customer logout opens eProcure when its tabs are closed and clicks Logout", async () => {
  loginPage();
  const events = browser();
  let signedIn = true;
  const control = { href: "/Logout.jsp", click() { signedIn = false; } };
  document.querySelectorAll = () => signedIn ? [control] : [];
  chrome.tabs.query = async () => [];
  assert.deepEqual(await logoutCustomer(), { ok: true });
  assert.equal(signedIn, false);
  assert.equal(events.created.length, 1);
});

test("customer logout reports website failures", async () => {
  loginPage();
  browser();
  document.querySelectorAll = () => [{ href: "/Logout.jsp", click() { throw new Error("Website logout failed"); } }];
  chrome.tabs.query = async () => [{ id: 7 }];
  await assert.rejects(logoutCustomer(), /Website logout failed/);
});

test("customer logout runs in MAIN world even without a content-script listener", async () => {
  loginPage();
  browser();
  let signedIn = true;
  const control = { href: "javascript:logout()", textContent: "Logout", click() { signedIn = false; } };
  document.querySelectorAll = () => signedIn ? [control] : [];
  chrome.tabs.query = async () => [{ id: 7 }];
  chrome.tabs.sendMessage = async () => { throw new Error("Receiving end does not exist"); };
  chrome.scripting.executeScript = async ({ world, func, args }) => {
    assert.equal(world, "MAIN");
    // Match Chrome's serialization so references to module helpers cannot pass.
    const injected = new Function(`return (${func.toString()})`)();
    return [{ result: injected(...args) }];
  };
  assert.deepEqual(await logoutCustomer(), { ok: true });
  assert.equal(signedIn, false);
});

test("customer logout rejects an unrecognized page instead of reporting success", async () => {
  loginPage({ missing: true });
  browser();
  chrome.tabs.query = async () => [{ id: 7 }];
  await assert.rejects(logoutCustomer(), /Could not find.*Logout control/);
});

test("opens a new eProcure tab, fills the selected credentials, and clicks login once", async () => {
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
  assert.equal(events.created.length, 1);
});

test("does not disclose credentials after a redirect or a changed form destination", () => {
  for (const options of [{ origin: "https://example.com" }, { action: "https://example.com/login" }]) {
    const page = loginPage(options);
    assert.equal(submitCustomerLogin("customer@example.com", "secret", SITE_ORIGIN).ok, false);
    assert.equal(page.email.savedValue, undefined);
    assert.equal(page.password.savedValue, undefined);
    assert.equal(page.button.clicks, 0);
  }
});

test("recognizes Logout.jsp even in a collapsed menu and ignores foreign links", () => {
  loginPage();
  const link = (href, visible = true) => ({ href, getClientRects: () => visible ? [1] : [] });
  document.querySelectorAll = () => [link("https://example.com/Logout.jsp")];
  assert.equal(resolveCustomerLogout().hasLogoutControl, false);
  document.querySelectorAll = () => [link("/Logout.jsp", false)];
  assert.equal(resolveCustomerLogout().hasLogoutControl, true);
  document.querySelectorAll = () => [link("/tenderer/LogOut.jsp?action=logout")];
  assert.equal(resolveCustomerLogout().hasLogoutControl, true);
});

test("recognizes a JavaScript logout menu by its label", () => {
  loginPage();
  document.querySelectorAll = (selector) => selector === "a[href]" ? [] : [{ textContent: " Log out " }];
  assert.equal(resolveCustomerLogout().hasLogoutControl, true);
});

test("the injected logout function clicks the page control only for logout", () => {
  loginPage();
  let clicks = 0;
  document.querySelectorAll = () => [{ href: "/Logout.jsp", click() { clicks++; } }];
  window.location.assign = () => assert.fail("Logout must click the page control");
  assert.equal(resolveCustomerLogout("inspectCustomerSession").ok, true);
  assert.equal(clicks, 0);
  assert.equal(resolveCustomerLogout("logoutCustomer").hasLogoutControl, true);
  assert.equal(clicks, 1);
});

test("clicks the website Logout control and waits before logging in", async () => {
  const page = loginPage();
  const { stored } = browser();
  let loggedIn = true;
  let logoutClicks = 0;
  const logout = { href: "/Logout.jsp", click() { logoutClicks++; loggedIn = false; } };
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/Dashboard.jsp" }];
  document.querySelectorAll = () => loggedIn ? [logout] : [];
  chrome.tabs.create = async () => {
    assert.equal(loggedIn, false);
    assert.equal(logoutClicks, 1);
    return { id: 8 };
  };
  const result = await loginCustomer({ email: "customer@example.com", password: "secret" });
  assert.equal(result.ok, true);
  assert.equal(page.email.savedValue, "customer@example.com");
  assert.equal(page.password.savedValue, "secret");
  assert.equal(page.button.clicks, 1);
  assert.equal(stored.encryptPassword, "secret");
});

test("keeps the saved password when the login form is unavailable", async () => {
  loginPage({ missing: true });
  const { stored } = browser();
  const result = await loginCustomer({ email: "customer@example.com", password: "secret" });
  assert.equal(result.ok, false);
  assert.equal(stored.encryptPassword, "previous-password");
});

test("waits through logout navigation before opening the login tab", async () => {
  loginPage();
  browser();
  let loggingOut = false;
  let finished = false;
  let loadingChecks = 0;
  document.querySelectorAll = () => finished ? [] : [{ href: "/Logout.jsp", click() { loggingOut = true; } }];
  chrome.tabs.get = async () => {
    if (loggingOut && !finished) {
      if (loadingChecks++ === 0) return { status: "loading" };
      finished = true;
    }
    return { status: "complete" };
  };
  chrome.tabs.create = async () => {
    assert.equal(finished, true);
    return { id: 8 };
  };
  assert.equal((await loginCustomer({ email: "customer@example.com", password: "secret" })).submitted, true);
});

test("saves the selected customer's password when login awaits manual verification", async () => {
  loginPage({ challenge: true });
  const { stored } = browser();
  const result = await loginCustomer({ email: "customer@example.com", password: "customer-password" });
  assert.equal(result.ok, true);
  assert.match(result.message, /Complete the verification/);
  assert.equal(stored.encryptPassword, "customer-password");
});

test("logs out a shared session discovered in the new tab when starting on another website", async () => {
  const page = loginPage();
  browser();
  chrome.tabs.query = async () => [{ id: 7, url: "https://example.com" }];
  let loggedIn = false;
  let clicks = 0;
  document.querySelectorAll = () => loggedIn ? [{ href: "/Logout.jsp", click() { clicks++; loggedIn = false; } }] : [];
  chrome.tabs.create = async () => { loggedIn = true; return { id: 8 }; };
  chrome.tabs.update = async (id, { url }) => {
    assert.equal(id, 8);
    assert.equal(url, "https://www.eprocure.gov.bd/");
    assert.equal(loggedIn, false);
    return { id };
  };
  const result = await loginCustomer({ email: "customer@example.com", password: "secret" });
  assert.equal(result.ok, true);
  assert.equal(clicks, 1);
  assert.equal(page.password.savedValue, "secret");
  assert.equal(page.button.clicks, 1);
});

test("leaves a visible verification challenge for the user", () => {
  const page = loginPage({ challenge: true });
  const result = submitCustomerLogin("customer@example.com", "secret", SITE_ORIGIN);
  assert.equal(result.ok, true);
  assert.match(result.message, /Complete the verification/);
  assert.equal(page.password.savedValue, "secret");
  assert.equal(page.captcha.focused, true);
  assert.equal(page.button.clicks, 0);
});

test("reports an unavailable login form", () => {
  loginPage({ missing: true });
  assert.equal(submitCustomerLogin("customer@example.com", "secret", SITE_ORIGIN).ok, false);
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
    if (func === submitCustomerLogin) {
      loggedIn = true;
      return [{ result: { ok: true, message: "Login submitted." } }];
    }
    assert.equal(func, resolveCustomerLogout);
    return [{ result: { ok: true, hasLogoutControl: loggedIn, loginForm: !loggedIn } }];
  };
  let url = "https://www.eprocure.gov.bd/";
  const actions = [];
  chrome.tabs.get = async () => ({ url, status: "complete" });
  chrome.tabs.update = async (id, options) => { url = options.url; };
  chrome.tabs.sendMessage = async (id, message) => {
    assert.equal(loggedIn, true);
    actions.push(message.action);
    if (message.action === "readCustomerProfile") return { ok: true, profile: { businessName: "Selected Co", registeredAddress: "Dhaka" } };
    url = message.action === "openViewProfilePage"
      ? "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=selected"
      : "https://www.eprocure.gov.bd/tenderer/ViewCompanyDetail.jsp?uId=selected&tId=tenderer&cId=company";
    return { ok: true, url };
  };
  const result = await loginCustomer({ email: "customer@example.com", password: "secret", collectProfile: true });
  assert.deepEqual(result.profile, { businessName: "Selected Co", registeredAddress: "Dhaka" });
  assert.deepEqual(actions, ["openViewProfilePage", "openCompanyDetailsTaba", "readCustomerProfile"]);
  assert.ok(calls.includes(submitCustomerLogin));
});

test("does not open a new tab, disclose credentials, or collect a profile if logout fails", async () => {
  loginPage();
  browser();
  document.querySelectorAll = () => [{ href: "/Logout.jsp", click() { throw new Error("Logout failed"); } }];
  chrome.tabs.query = async () => [{ id: 7, url: "https://www.eprocure.gov.bd/Dashboard.jsp" }];
  chrome.tabs.create = async () => { assert.fail("Do not open a login tab before logout completes"); };
  await assert.rejects(loginCustomer({ email: "another@example.com", password: "secret", collectProfile: true }), /Logout failed/);
});
