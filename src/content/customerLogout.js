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
  if (action === "inspectCustomerLogin") {
    const error = [...document.querySelectorAll('[role="alert"], .error, .error-message, .errorMessage, .alert-danger, #error, #errorMsg, #errorMessage, #popup_message')]
      .find((element) => element.getClientRects().length > 0 && element.textContent?.trim());
    const rejection = /(?:invalid|incorrect|wrong)\s+(?:user(?:name)?|e-?mail|password|credentials)|(?:user(?:name)?|e-?mail|password|credentials)[^\n.]{0,60}(?:invalid|incorrect|wrong)|authentication\s+failed|login\s+failed|account[^\n.]{0,40}(?:locked|disabled|blocked)/i;
    const message = error?.textContent.trim() || (document.body?.innerText || "").split("\n").find((line) => rejection.test(line))?.trim() || "";
    return { ok: true, hasLogoutControl, loginForm, loginError: loginForm ? message : "" };
  }
  if (action === "logoutCustomer" && control) control.click();
  return { ok: true, hasLogoutControl, loginForm };
}
