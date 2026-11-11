import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { missingCustomerDetails } from "./customerProfile.js";
import { collectCustomerProfile } from "../background/customerProfile.js";
import { openCompanyDetailsTaba, handleCustomerProfileRequest, findCustomerCompanyLink, findCustomerProfileLink, readCustomerProfile } from "../content/customerProfile.js";

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

test("content script rejects empty business details", async () => {
  globalThis.window = { location: { origin: "https://www.eprocure.gov.bd", pathname: "/tenderer/ViewCompanyDetail.jsp" } };
  globalThis.document = { querySelectorAll: () => [] };
  await assert.rejects(handleCustomerProfileRequest("readCustomerProfile"), /Could not find business details/);
});
