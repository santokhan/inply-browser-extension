// These page functions must remain self-contained for executeScript.
export function findCustomerProfileLink() {
  if (window.location.origin !== "https://www.eprocure.gov.bd") return null;
  for (const anchor of document.querySelectorAll("a[href]")) {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === "/tenderer/ViewRegistrationDetail.jsp") {
      return url.href;
    }
  }
  return null;
}

export function findCustomerCompanyLink() {
  if (window.location.origin !== "https://www.eprocure.gov.bd" ||
      window.location.pathname !== "/tenderer/ViewRegistrationDetail.jsp") return null;
  for (const anchor of document.querySelectorAll("a[href]")) {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === "/tenderer/ViewCompanyDetail.jsp") {
      return url.href;
    }
  }
  return null;
}

export function readCustomerProfile() {
  if (window.location.origin !== "https://www.eprocure.gov.bd" ||
      window.location.pathname !== "/tenderer/ViewCompanyDetail.jsp") return {};
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

export async function collectCustomerProfile(tabId, { inspectSession, waitForTab, timeout = 120000 }) {
  const deadline = Date.now() + timeout;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && !tab.url.startsWith("https://www.eprocure.gov.bd/")) {
      throw new Error("Profile collection stopped because the tab left eProcure.");
    }
    if (tab.status === "complete") {
      try { loggedIn = Boolean((await inspectSession()).logoutUrl); } catch { /* Navigation may replace the document during inspection. */ }
      if (loggedIn) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!loggedIn) throw new Error("Complete eProcure login to collect the missing business details.");
  const [link] = await chrome.scripting.executeScript({ target: { tabId }, func: findCustomerProfileLink });
  if (!link?.result) throw new Error("The signed-in page has no View Profile link.");
  const url = new URL(link.result);
  if (url.origin !== "https://www.eprocure.gov.bd" || url.pathname !== "/tenderer/ViewRegistrationDetail.jsp") {
    throw new Error("The View Profile link does not point to the eProcure registration page.");
  }
  await chrome.tabs.update(tabId, { url: url.href });
  await waitForTab(tabId);
  const [companyLink] = await chrome.scripting.executeScript({ target: { tabId }, func: findCustomerCompanyLink });
  if (!companyLink?.result) throw new Error("The View Profile page has no Company Details link.");
  const companyUrl = new URL(companyLink.result);
  if (companyUrl.origin !== "https://www.eprocure.gov.bd" || companyUrl.pathname !== "/tenderer/ViewCompanyDetail.jsp") {
    throw new Error("The Company Details link does not point to the eProcure company page.");
  }
  await chrome.tabs.update(tabId, { url: companyUrl.href });
  await waitForTab(tabId);
  const [profile] = await chrome.scripting.executeScript({ target: { tabId }, func: readCustomerProfile });
  if (!profile?.result?.businessName && !profile?.result?.registeredAddress) {
    throw new Error("Could not find business details on the Company Details page.");
  }
  return profile.result;
}

export function missingCustomerDetails(current, collected) {
  return Object.fromEntries(["businessName", "registeredAddress"]
    .filter((key) => !String(current?.[key] ?? "").trim() && typeof collected?.[key] === "string" && collected[key].trim())
    .map((key) => [key, collected[key].trim()]));
}
