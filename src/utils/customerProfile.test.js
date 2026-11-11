import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { missingCustomerDetails } from "./customerProfile.js";
import { collectCustomerProfile } from "../background/customerProfile.js";
import { collectSignedInCustomerProfile } from "./customerLogin.js";
import { openCompanyDetailsTaba, handleCustomerProfileRequest, findCustomerBankLink, findCustomerCompanyLink, findCustomerProfileLink, readCustomerBankDetails, readCustomerProfile } from "../content/customerProfile.js";

afterEach(() => {
  for (const key of ["window", "document", "chrome"]) delete globalThis[key];
});

test("discovers the current account's View Profile URL and rejects foreign links", () => {
  globalThis.window = { location: { origin: "https://www.eprocure.gov.bd", href: "https://www.eprocure.gov.bd/Dashboard.jsp" } };
  globalThis.document = { querySelectorAll: () => [
    { href: "https://example.com/tenderer/ViewRegistrationDetail.jsp" },
    { href: "/tenderer/ViewRegistrationDetail.jsp?uId=current&cId=company&tId=tenderer" },
  ] };
  assert.equal(findCustomerProfileLink(), "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=current&cId=company&tId=tenderer");
});

function cell(text, nextElementSibling = null) {
  return { textContent: text, innerText: text, nextElementSibling, matches: () => false, querySelector: () => null };
}

test("reads Company Name and Registered Address from the company table", () => {
  globalThis.window = { location: { origin: "https://www.eprocure.gov.bd", pathname: "/tenderer/ViewCompanyDetail.jsp" } };
  globalThis.document = { querySelectorAll: () => [
    cell("Company Name in Bangla :", cell("Other name")),
    cell("Company Name : ", cell(":", cell("Example & Company"))),
    cell("Registered Address : ", cell("12 Main Road\nDhaka")),
    cell("Corporate / Head office Address :", cell("Different office address")),
  ] };
  assert.deepEqual(readCustomerProfile(), { businessName: "Example & Company", registeredAddress: "12 Main Road\nDhaka" });
  window.location.pathname = "/Login.jsp";
  assert.deepEqual(readCustomerProfile(), {});
});

test("resolves the relative Company Details link against View Profile and keeps account parameters", () => {
  globalThis.window = { location: {
    origin: "https://www.eprocure.gov.bd", pathname: "/tenderer/ViewRegistrationDetail.jsp",
    href: "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=current",
  } };
  globalThis.document = { querySelectorAll: () => [
    { href: "https://example.com/tenderer/ViewCompanyDetail.jsp" },
    { href: "ViewCompanyDetail.jsp?uId=current&tId=tenderer&cId=company" },
  ] };
  assert.equal(findCustomerCompanyLink(), "https://www.eprocure.gov.bd/tenderer/ViewCompanyDetail.jsp?uId=current&tId=tenderer&cId=company");
  window.location.pathname = "/Login.jsp";
  assert.equal(findCustomerCompanyLink(), null);
});

test("fills either missing detail and preserves already saved fields", () => {
  const collected = { businessName: "Collected Co", registeredAddress: "Collected address" };
  assert.deepEqual(missingCustomerDetails({ businessName: "Saved Co", registeredAddress: " " }, collected), { registeredAddress: "Collected address" });
  assert.deepEqual(missingCustomerDetails({ registeredAddress: "Saved address" }, collected), { businessName: "Collected Co" });
  assert.deepEqual(missingCustomerDetails({}, { businessName: " " }), {});
});

function browser(profile = { businessName: "Collected Co", registeredAddress: "Dhaka" }) {
  const actions = [];
  let url = "https://www.eprocure.gov.bd/Dashboard.jsp";
  globalThis.chrome = {
    tabs: {
      get: async () => ({ url, status: "complete" }),
      sendMessage: async (id, message, options) => {
        assert.equal(id, 7);
        assert.deepEqual(options, { frameId: 0 });
        actions.push(message.action);
        if (message.action === "readCustomerProfile") return { ok: true, profile };
        if (message.action === "readCustomerBankDetails") return { ok: true, profile: { bankName: "Example Bank" } };
        if (message.action === "openBankDetailsTab") {
          url = "https://www.eprocure.gov.bd/tenderer/ViewBankDetail.jsp?uId=current&cId=company";
          return { ok: true, url };
        }
        url = message.action === "openViewProfilePage"
          ? "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=current"
          : "https://www.eprocure.gov.bd/tenderer/ViewCompanyDetail.jsp?uId=current&tId=tenderer&cId=company";
        return { ok: true, url };
      },
    },
  };
  return { actions };
}

test("requests profile and company navigation from the content script before reading details", async () => {
  const { actions } = browser();
  const result = await collectCustomerProfile(7, { inspectSession: async () => ({ hasLogoutControl: true }) });
  assert.equal(result.businessName, "Collected Co");
  assert.deepEqual(actions, ["openViewProfilePage", "openCompanyDetailsTaba", "readCustomerProfile"]);
});

test("does not navigate before login is confirmed or after leaving eProcure", async () => {
  const { actions } = browser();
  await assert.rejects(collectCustomerProfile(7, { inspectSession: async () => ({}), timeout: 0 }), /Complete eProcure login/);
  chrome.tabs.get = async () => ({ url: "https://example.com", status: "complete" });
  await assert.rejects(collectCustomerProfile(7, { inspectSession: async () => ({ hasLogoutControl: true }) }), /left eProcure/);
  assert.equal(actions.length, 0);
});

test("reports content script errors without continuing navigation", async () => {
  browser();
  chrome.tabs.sendMessage = async () => ({ ok: false, message: "Close the login notice first." });
  await assert.rejects(collectCustomerProfile(7, {
    inspectSession: async () => ({ hasLogoutControl: true }),
  }), /Close the login notice first/);
});

test("waits for content-script navigation instead of reading the previous document", async () => {
  browser();
  let gets = 0;
  const get = chrome.tabs.get;
  chrome.tabs.get = async () => {
    gets += 1;
    if (gets === 3) return { url: "https://www.eprocure.gov.bd/Dashboard.jsp", status: "complete" };
    return get();
  };
  const result = await collectCustomerProfile(7, { inspectSession: async () => ({ hasLogoutControl: true }) });
  assert.equal(result.businessName, "Collected Co");
  assert.ok(gets >= 6);
});

test("content script waits for the login notice before visiting View Profile", async () => {
  globalThis.window = { location: { origin: "https://www.eprocure.gov.bd" }, InplyModalCloser: {
    close: async () => ({ ready: false, message: "Close the login notice first." }),
  } };
  await assert.rejects(handleCustomerProfileRequest("openViewProfilePage", () => assert.fail("Must not navigate")), /Close the login notice first/);
});

test("content script navigates to the account company link after responding", async () => {
  globalThis.window = { location: {
    origin: "https://www.eprocure.gov.bd", pathname: "/tenderer/ViewRegistrationDetail.jsp",
    href: "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=current",
  } };
  globalThis.document = { querySelectorAll: () => [{ href: "ViewCompanyDetail.jsp?uId=current&cId=company" }] };
  let destination;
  const response = await openCompanyDetailsTaba((url) => { destination = url; });
  assert.equal(response.ok, true);
  assert.equal(destination, undefined);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(destination, "https://www.eprocure.gov.bd/tenderer/ViewCompanyDetail.jsp?uId=current&cId=company");
});

test("content script clicks the site's profile, company and bank anchors after responding", async () => {
  const origin = "https://www.eprocure.gov.bd";
  const clicks = [];
  globalThis.window = {
    location: { origin, pathname: "/Dashboard.jsp", href: `${origin}/Dashboard.jsp` },
    InplyModalCloser: { close: async () => ({ ready: true }) },
  };
  let anchors = [];
  globalThis.document = { querySelectorAll: () => anchors };
  for (const [action, href, label] of [
    ["openViewProfilePage", "/tenderer/ViewRegistrationDetail.jsp?uId=current", "View Profile"],
    ["openCompanyDetailsTaba", "ViewCompanyDetail.jsp?uId=current&cId=company", "Company Details"],
    ["openBankDetailsTab", "ViewBankDetail.jsp?uId=current&cId=company", "Bank Details"],
  ]) {
    window.location.pathname = action === "openViewProfilePage" ? "/Dashboard.jsp" : "/tenderer/ViewRegistrationDetail.jsp";
    window.location.href = `${origin}${window.location.pathname}?uId=current`;
    anchors = [{ href, textContent: label, click: () => clicks.push(label) }];
    const before = clicks.length;
    const response = await handleCustomerProfileRequest(action);
    assert.equal(response.ok, true);
    assert.equal(clicks.length, before, "Send the reply before clicking a link that unloads the page");
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(clicks.length, before + 1);
    assert.equal(clicks.at(-1), label);
  }
});

test("an already open View Profile page proceeds without reloading", async () => {
  globalThis.window = {
    location: {
      origin: "https://www.eprocure.gov.bd", pathname: "/tenderer/ViewRegistrationDetail.jsp",
      href: "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=current",
    },
    InplyModalCloser: { close: async () => ({ ready: true }) },
  };
  globalThis.document = { querySelectorAll: () => assert.fail("The profile page is already open") };
  const response = await handleCustomerProfileRequest("openViewProfilePage");
  assert.equal(response.url, window.location.href);
  await new Promise((resolve) => setTimeout(resolve, 10));
});

test("content script rejects empty business details", async () => {
  globalThis.window = { location: { origin: "https://www.eprocure.gov.bd", pathname: "/tenderer/ViewCompanyDetail.jsp" } };
  globalThis.document = { querySelectorAll: () => [] };
  await assert.rejects(handleCustomerProfileRequest("readCustomerProfile"), /Could not find business details/);
});

test("discovers the bank tab from its same-origin profile link", () => {
  globalThis.window = { location: {
    origin: "https://www.eprocure.gov.bd", pathname: "/tenderer/ViewRegistrationDetail.jsp",
    href: "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=current",
  } };
  globalThis.document = { querySelectorAll: () => [
    { href: "https://example.com/tenderer/ViewBankDetail.jsp", textContent: "Bank Details" },
    { href: "javascript:void(0)", textContent: "Bank Details" },
    { href: "ViewBankDetail.jsp?uId=current&cId=company", textContent: "Bank Details" },
  ] };
  assert.equal(findCustomerBankLink(), "https://www.eprocure.gov.bd/tenderer/ViewBankDetail.jsp?uId=current&cId=company");
});

test("reads bank names from labeled values and account table columns", () => {
  globalThis.window = { location: { pathname: "/tenderer/ViewBankDetail.jsp" } };
  globalThis.document = { querySelectorAll: () => [cell("Bank Name :", cell(":", cell("Example Bank")))] };
  assert.deepEqual(readCustomerBankDetails(), { bankName: "Example Bank" });
  const header = { ...cell("Bank Name"), tagName: "TH" };
  const headerRow = { cells: [cell("SL"), header, cell("Branch Name")], parentElement: { tagName: "THEAD" } };
  const table = { rows: [headerRow, { cells: [cell("1"), cell("First Bank"), cell("Dhaka")] }, { cells: [cell("2"), cell("Second Bank"), cell("Chattogram")] }] };
  header.closest = (selector) => selector === "tr" ? headerRow : table;
  document.querySelectorAll = () => [header];
  assert.deepEqual(readCustomerBankDetails(), { bankName: "First Bank" });
  table.rows = [headerRow];
  assert.deepEqual(readCustomerBankDetails(), {});
});

test("collects only bank details when company details are already saved", async () => {
  const { actions } = browser();
  const profile = await collectCustomerProfile(7, { inspectSession: async () => ({ hasLogoutControl: true }), fields: ["bankName"] });
  assert.deepEqual(profile, { bankName: "Example Bank" });
  assert.deepEqual(actions, ["openViewProfilePage", "openBankDetailsTab", "readCustomerBankDetails"]);
});

test("collects company and bank details and exposes partial results if the bank tab fails", async () => {
  const { actions } = browser();
  const options = { inspectSession: async () => ({ hasLogoutControl: true }), fields: ["businessName", "registeredAddress", "bankName"] };
  assert.deepEqual(await collectCustomerProfile(7, options), { businessName: "Collected Co", registeredAddress: "Dhaka", bankName: "Example Bank" });
  assert.deepEqual(actions, ["openViewProfilePage", "openCompanyDetailsTaba", "readCustomerProfile", "openBankDetailsTab", "readCustomerBankDetails"]);
  const send = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (id, message, options) => message.action === "openBankDetailsTab"
    ? { ok: false, message: "No Bank Details link" } : send(id, message, options);
  await assert.rejects(collectCustomerProfile(7, options), (error) => {
    assert.deepEqual(error.profile, { businessName: "Collected Co", registeredAddress: "Dhaka" });
    return /No Bank Details link/.test(error.message);
  });
});

test("saves a missing bank name while preserving an existing bank", () => {
  assert.deepEqual(missingCustomerDetails({ bankName: " " }, { bankName: " Example Bank " }), { bankName: "Example Bank" });
  assert.deepEqual(missingCustomerDetails({ bankName: "Saved Bank" }, { bankName: "Other Bank" }), {});
});

test("continues collecting the bank when company details cannot be read", async () => {
  browser();
  const send = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (id, message, options) => message.action === "readCustomerProfile"
    ? { ok: false, message: "Company details unavailable" } : send(id, message, options);
  await assert.rejects(collectCustomerProfile(7, {
    inspectSession: async () => ({ hasLogoutControl: true }), fields: ["businessName", "bankName"],
  }), (error) => {
    assert.deepEqual(error.profile, { bankName: "Example Bank" });
    return /Company details unavailable/.test(error.message);
  });
});

test("manual collection reuses the customer's login tab without submitting login again", async () => {
  const { actions } = browser();
  let activated;
  const get = chrome.tabs.get;
  chrome.tabs.get = async (id) => ({ ...await get(id), id });
  chrome.tabs.update = async (id, values) => { activated = { id, ...values }; };
  chrome.tabs.create = async () => assert.fail("The customer's login tab should be reused");
  chrome.scripting = { executeScript: async () => [{ result: { ok: true, hasLogoutControl: true } }] };
  const result = await collectSignedInCustomerProfile({ tabId: 7, fields: ["bankName"] });
  assert.deepEqual(result, { ok: true, profile: { bankName: "Example Bank" }, tabId: 7 });
  assert.deepEqual(activated, { id: 7, active: true });
  assert.deepEqual(actions, ["openViewProfilePage", "openBankDetailsTab", "readCustomerBankDetails"]);
});

test("clicks View Profile, Company Details and Bank Details in order using the page's relative links", async () => {
  const origin = "https://www.eprocure.gov.bd";
  const profileHref = "/tenderer/ViewRegistrationDetail.jsp?uId=current&cId=company&tId=tenderer";
  const companyHref = "ViewCompanyDetail.jsp?uId=current&tId=tenderer&cId=company";
  const bankHref = "ViewBankDetail.jsp?uId=current&tId=tenderer&cId=company";
  const clicks = [];
  const actions = [];
  globalThis.window = {
    location: { origin, href: `${origin}/Dashboard.jsp`, pathname: "/Dashboard.jsp" },
    InplyModalCloser: { close: async () => ({ ready: true }) },
  };
  const anchor = (href, label) => ({
    href, textContent: label,
    click() {
      clicks.push(label);
      const destination = new URL(href, window.location.href);
      window.location.href = destination.href;
      window.location.pathname = destination.pathname;
    },
  });
  globalThis.document = { querySelectorAll(selector) {
    if (selector === "a[href]") {
      return window.location.pathname === "/Dashboard.jsp"
        ? [anchor(profileHref, "View Profile")]
        : [anchor(companyHref, "Company Details"), anchor(bankHref, "Bank Details")];
    }
    if (window.location.pathname === "/tenderer/ViewCompanyDetail.jsp") {
      return [cell("Company Name :", cell("Example Company")), cell("Registered Address :", cell("Dhaka"))];
    }
    return [cell("Bank Name :", cell("Example Bank"))];
  } };
  globalThis.chrome = { tabs: {
    get: async () => ({ id: 7, url: window.location.href, status: "complete" }),
    sendMessage: async (id, { action }) => {
      actions.push(action);
      return handleCustomerProfileRequest(action);
    },
  } };
  const profile = await collectCustomerProfile(7, {
    inspectSession: async () => ({ hasLogoutControl: true }),
    fields: ["businessName", "registeredAddress", "bankName"],
  });
  assert.deepEqual(profile, { businessName: "Example Company", registeredAddress: "Dhaka", bankName: "Example Bank" });
  assert.deepEqual(clicks, ["View Profile", "Company Details", "Bank Details"]);
  assert.deepEqual(actions, ["openViewProfilePage", "openCompanyDetailsTaba", "readCustomerProfile", "openBankDetailsTab", "readCustomerBankDetails"]);
  assert.equal(window.location.href, `${origin}/tenderer/${bankHref}`);
});
