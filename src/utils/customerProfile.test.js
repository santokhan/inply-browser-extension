import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { collectCustomerProfile, findCustomerCompanyLink, findCustomerProfileLink, missingCustomerDetails, readCustomerProfile } from "./customerProfile.js";

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
  const navigation = [];
  const injections = [];
  globalThis.chrome = {
    tabs: {
      get: async () => ({ url: "https://www.eprocure.gov.bd/Dashboard.jsp", status: "complete" }),
      update: async (id, options) => { navigation.push({ id, ...options }); },
    },
    scripting: { executeScript: async ({ func }) => {
      injections.push(func);
      return [{ result: func === findCustomerProfileLink
        ? "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=current"
        : func === findCustomerCompanyLink
          ? "https://www.eprocure.gov.bd/tenderer/ViewCompanyDetail.jsp?uId=current&tId=tenderer&cId=company"
          : profile }];
    } },
  };
  return { navigation, injections };
}

test("waits for login and both profile and company navigation before reading details", async () => {
  const { navigation, injections } = browser();
  let waited = 0;
  const result = await collectCustomerProfile(7, {
    inspectSession: async () => ({ logoutUrl: "/Logout.jsp" }),
    waitForTab: async (id) => { assert.equal(id, 7); waited += 1; },
  });
  assert.equal(waited, 2);
  assert.equal(result.businessName, "Collected Co");
  assert.deepEqual(navigation, [
    { id: 7, url: "https://www.eprocure.gov.bd/tenderer/ViewRegistrationDetail.jsp?uId=current" },
    { id: 7, url: "https://www.eprocure.gov.bd/tenderer/ViewCompanyDetail.jsp?uId=current&tId=tenderer&cId=company" },
  ]);
  assert.deepEqual(injections, [findCustomerProfileLink, findCustomerCompanyLink, readCustomerProfile]);
});

test("does not navigate before login is confirmed or after leaving eProcure", async () => {
  const { navigation } = browser();
  await assert.rejects(collectCustomerProfile(7, { inspectSession: async () => ({}), timeout: 0 }), /Complete eProcure login/);
  chrome.tabs.get = async () => ({ url: "https://example.com", status: "complete" });
  await assert.rejects(collectCustomerProfile(7, { inspectSession: async () => ({ logoutUrl: "/Logout.jsp" }) }), /left eProcure/);
  assert.equal(navigation.length, 0);
});

test("reports missing profile details without returning empty data as a success", async () => {
  browser({});
  await assert.rejects(collectCustomerProfile(7, {
    inspectSession: async () => ({ logoutUrl: "/Logout.jsp" }), waitForTab: async () => {},
  }), /Could not find business details/);
});
