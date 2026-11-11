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

async function openViewProfilePage(activateLink = clickProfileLink) {
  // The background confirms the session before requesting profile navigation.
  // Logout may be inside a collapsed menu while the customer is signed in.
  const modal = await installModalCloser({ sessionConfirmed: true });
  if (!modal?.ready) throw new Error(modal?.message || "Close the login notice before collecting business details.");
  const url = window.location.pathname === "/tenderer/ViewRegistrationDetail.jsp" ? window.location.href : findCustomerProfileLink();
  if (!url) throw new Error("The signed-in page has no View Profile link.");
  return openProfileLink(url, activateLink);
}

function openCompanyDetailsTaba(activateLink = clickProfileLink) {
  const url = findCustomerCompanyLink();
  if (!url) throw new Error("The View Profile page has no Company Details link.");
  return openProfileLink(url, activateLink);
}

function findCustomerBankLink() {
  if (!["/tenderer/ViewRegistrationDetail.jsp", "/tenderer/ViewCompanyDetail.jsp", "/tenderer/ViewBankDetail.jsp"].includes(window.location.pathname)) return null;
  for (const anchor of document.querySelectorAll("a[href]")) {
    const url = new URL(anchor.href, window.location.href);
    const label = (anchor.textContent || "").replace(/\s+/g, " ").trim();
    if (url.origin === window.location.origin && /^\/tenderer\/[^/]+\.jsp$/i.test(url.pathname)
      && (/^bank(?:ing)?\s+(?:details|information)$/i.test(label) || /\/ViewBank[^/]*\.jsp$/i.test(url.pathname))) {
      return url.href;
    }
  }
  return null;
}

function openBankDetailsTab(activateLink = clickProfileLink) {
  const url = findCustomerBankLink();
  if (!url) throw new Error("The View Profile page has no Bank Details link.");
  return openProfileLink(url, activateLink);
}

function openProfileLink(url, activateLink) {
  // Allow the message response to reach the worker before unloading this document.
  setTimeout(() => activateLink(url), 0);
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
  return readLabeledDetails({
    businessName: ["businessname", "nameofbusiness", "companyname", "nameofcompany", "organizationname", "organisationname", "nameoforganization", "nameoforganisation"],
    registeredAddress: ["registeredaddress", "registeredbusinessaddress", "registeredofficeaddress"],
  });
}

function readCustomerBankDetails() {
  if (!/^\/tenderer\/[^/]+\.jsp$/i.test(window.location.pathname)) return {};
  return readLabeledDetails({ bankName: ["bankname", "nameofbank", "bankersname", "nameofbanker"] }, true);
}

function readLabeledDetails(aliases, tableColumns = false) {
  const normalize = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const result = {};
  const valueOf = (element) => {
    const input = element.matches("input, textarea, select") ? element : element.querySelector("input, textarea, select");
    const selectedText = input?.tagName === "SELECT" ? input.selectedOptions?.[0]?.textContent : undefined;
    return String(selectedText ?? input?.value ?? element.innerText ?? element.textContent ?? "").trim();
  };
  for (const [key, names] of Object.entries(aliases)) {
    for (const label of document.querySelectorAll("th, td, label, dt")) {
      if (!names.includes(normalize(label.textContent))) continue;
      // Bank Details may list accounts in rows beneath a Bank Name column.
      const row = label.closest?.("tr");
      const table = label.closest?.("table");
      const cells = Array.from(row?.cells || []);
      const isColumnHeader = row?.parentElement?.tagName === "THEAD"
        || (cells.length > 1 && cells.every((cell) => cell.tagName === "TH"))
        || cells.some((cell) => /^(?:branchname|accountnumber|accountno|bankbranch)$/.test(normalize(cell.textContent)));
      if (tableColumns && isColumnHeader) {
        const column = Array.from(row?.cells || []).indexOf(label);
        const rows = Array.from(table?.rows || []);
        const value = rows.slice(rows.indexOf(row) + 1)
          .map((item) => item.cells[column])
          .filter(Boolean)
          .map(valueOf)
          .find((text) => text && text !== "-" && !names.includes(normalize(text)));
        if (value) { result[key] = value; break; }
        continue;
      }
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

function clickProfileLink(url) {
  // The profile page can already be open when collection starts or retries.
  if (window.location.href === url) return;
  const anchor = Array.from(document.querySelectorAll("a[href]")).find((element) =>
    new URL(element.href, window.location.href).href === url);
  if (!anchor) throw new Error("The profile navigation link is no longer available. Try collecting again.");
  anchor.click();
}

async function handleCustomerProfileRequest(action) {
  if (action === "readCustomerProfile") {
    const profile = readCustomerProfile();
    if (!profile.businessName && !profile.registeredAddress) {
      throw new Error("Could not find business details on the Company Details page.");
    }
    return { ok: true, profile };
  }
  if (action === "openViewProfilePage") return openViewProfilePage();
  if (action === "openCompanyDetailsTaba") return openCompanyDetailsTaba();
  if (action === "openBankDetailsTab") return openBankDetailsTab();
  if (action === "readCustomerBankDetails") {
    const profile = readCustomerBankDetails();
    if (!profile.bankName) throw new Error("Could not find a bank name on the Bank Details page.");
    return { ok: true, profile };
  }
  throw new Error("Unknown customer profile action.");
}

export {
  findCustomerCompanyLink,
  findCustomerBankLink,
  findCustomerProfileLink,
  openViewProfilePage,
  openCompanyDetailsTaba,
  readCustomerProfile,
  readCustomerBankDetails,
  handleCustomerProfileRequest
};
