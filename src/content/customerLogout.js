// Self-contained so the background can also execute this in the page's MAIN world.
export function resolveCustomerLogout(action = "inspectCustomerSession", expectedOrigin) {
  if (expectedOrigin && window.location.origin !== expectedOrigin) {
    return { ok: false, message: "Customer logout stopped because the page left eProcure." };
  }
  const link = [...document.querySelectorAll("a[href]")].find((anchor) => {
    try {
      const url = new URL(anchor.href, window.location.href);
      return url.origin === window.location.origin && /(?:^|\/)logout(?:\.jsp)?\/?$/i.test(url.pathname);
    } catch { return false; }
  });
  // Some authenticated pages render Logout as a JavaScript menu control.
  const control = link || [...document.querySelectorAll("a, button, input[type='button'], input[type='submit']")].find((element) => {
    if (element.href) {
      try {
        const url = new URL(element.href, window.location.href);
        if (url.protocol !== "javascript:" && url.origin !== window.location.origin) return false;
      } catch { return false; }
    }
    const label = (element.textContent || element.value || element.getAttribute?.("aria-label") || "").replace(/\s+/g, " ").trim();
    return /^log\s*out$/i.test(label);
  });
  const loginForm = Boolean(document.querySelector('form#frmLogin input[name="emailId"]'));
  const hasLogoutControl = Boolean(control);
  if (action === "logoutCustomer" && control) control.click();
  return { ok: true, hasLogoutControl, loginForm };
}
