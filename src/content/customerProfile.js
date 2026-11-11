import { installModalCloser } from "./modalCloser.js";

// Page inspection and navigation run only in the eProcure content script.
function findCustomerProfileLink() {
  for (const anchor of document.querySelectorAll("a[href]")) {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === "/tenderer/ViewRegistrationDetail.jsp") {
      return url.href;
    }
  }
  return null;
}

async function openViewProfilePage(navigate = (url) => window.location.assign(url)) {
  const modal = await installModalCloser();
  if (!modal?.ready) throw new Error(modal?.message || "Close the login notice before collecting business details.");
  const url = findCustomerProfileLink();
  if (!url) throw new Error("The signed-in page has no View Profile link.");
  return openProfileLink(url, navigate);
}

function openCompanyDetailsTaba(navigate = (url) => window.location.assign(url)) {
  const url = findCustomerCompanyLink();
  if (!url) throw new Error("The View Profile page has no Company Details link.");
  return openProfileLink(url, navigate);
}

function openProfileLink(url, navigate) {
  // Allow the message response to reach the worker before unloading this document.
  setTimeout(() => navigate(url), 0);
  return { ok: true, url };
}

function findCustomerCompanyLink() {
  if (window.location.pathname !== "/tenderer/ViewRegistrationDetail.jsp") return null;
  for (const anchor of document.querySelectorAll("a[href]")) {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === "/tenderer/ViewCompanyDetail.jsp") {
      return url.href;
    }
  }
  return null;
}

function readCustomerProfile() {
  if (window.location.pathname !== "/tenderer/ViewCompanyDetail.jsp") return {};
  const normalize = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = {
    businessName: ["businessname", "nameofbusiness", "companyname", "nameofcompany", "organizationname", "organisationname", "nameoforganization", "nameoforganisation"],
    registeredAddress: ["registeredaddress", "registeredbusinessaddress", "registeredofficeaddress"],
  };
  const result = {};
  const valueOf = (element) => {
    const input = element.matches("input, textarea, select") ? element : element.querySelector("input, textarea, select");
    return String(input?.value ?? element.innerText ?? element.textContent ?? "").trim();
  };
  for (const [key, names] of Object.entries(aliases)) {
    for (const label of document.querySelectorAll("th, td, label, dt")) {
      if (!names.includes(normalize(label.textContent))) continue;
      const linked = label.htmlFor ? document.getElementById(label.htmlFor) : null;
      // Skip empty separator cells between a label and its displayed value.
      let sibling = label.nextElementSibling;
      while (sibling && (!valueOf(sibling) || valueOf(sibling) === ":")) sibling = sibling.nextElementSibling;
      const value = linked ? valueOf(linked) : sibling ? valueOf(sibling) : "";
      if (value && value !== "-") { result[key] = value; break; }
    }
  }
  return result;
}

function navigate(url) {
  return window.location.assign(url);
}

async function handleCustomerProfileRequest(action) {
  if (action === "readCustomerProfile") {
    const profile = readCustomerProfile();
    if (!profile.businessName && !profile.registeredAddress) {
      throw new Error("Could not find business details on the Company Details page.");
    }
    return { ok: true, profile };
  }
  if (action === "openViewProfilePage") return openViewProfilePage(navigate);
  if (action === "openCompanyDetailsTaba") return openCompanyDetailsTaba(navigate);
  throw new Error("Unknown customer profile action.");
}

export {
  findCustomerCompanyLink,
  findCustomerProfileLink,
  openViewProfilePage,
  openCompanyDetailsTaba,
  readCustomerProfile,
  handleCustomerProfileRequest
};