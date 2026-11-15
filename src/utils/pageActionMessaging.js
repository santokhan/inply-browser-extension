const ENCRYPT_PASSWORD_KEY = "encryptPassword";

async function signAndVerifyInPage(password) {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const signButton = [...document.querySelectorAll(`#sign, input[name="sign"], button, input[type="button"], input[type="submit"], [role="button"]`)].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "").trim().toLowerCase();
    return (element.id === "sign" || element.name === "sign" || label === "sign") && !element.disabled && isVisible(element);
  });

  if (!signButton) {
    return { ok: false, verified: false, message: "No Sign button was found on this page." };
  }

  signButton.scrollIntoView({ block: "center", behavior: "smooth" });
  signButton.click();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const input = document.querySelector(
      '#myPanelDiv input#password, #myPanelDiv input[name="password"], #dialog-form input#password, #dialog-form input[name="password"]',
    );
    if (input && isVisible(input)) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, password);
      else input.value = password;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      const dialog = input.closest(".ui-dialog") || input.closest("#myPanelDiv, #dialog-form");
      const verifyButton = [...(dialog?.querySelectorAll("button, input[type=\"button\"], input[type=\"submit\"]") || [])].find((element) => {
        const label = (element.innerText || element.value || "").trim().toLowerCase();
        return label === "verify password" && !element.disabled && isVisible(element);
      });
      if (verifyButton) {
        verifyButton.click();
        return { ok: true, verified: true, count: 1 };
      }
    }
    await wait(250);
  }

  return { ok: true, verified: false, count: 1, message: "Sign clicked, but the password dialog was not ready." };
}

export async function sendSignAndVerifyMessage(tabId, password) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: "signAndVerify" });
    if (!response?.message?.includes('No content-script handler is registered for action "signAndVerify"')) {
      return response;
    }
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) throw error;
  }

  const resolvedPassword = password || (await chrome.storage.local.get(ENCRYPT_PASSWORD_KEY))?.[ENCRYPT_PASSWORD_KEY];
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: signAndVerifyInPage,
    args: [resolvedPassword],
  });
  return result?.result;
}


async function encryptInPage() {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const getButton = () => [...document.querySelectorAll('input#encrypt[name="encrypt"][value="Encrypt"]')]
    .find((element) => !element.disabled && isVisible(element));

  const deadline = Date.now() + 10000;
  let button;
  while (!(button = getButton()) && Date.now() < deadline) await wait(250);
  if (!button) return { ok: false, message: 'No enabled input#encrypt[name="encrypt"][value="Encrypt"] was found.' };

  button.scrollIntoView({ block: "center", behavior: "smooth" });
  if (typeof button.onclick === "function") {
    button.onclick.call(button, new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  } else {
    button.click();
  }
  return { ok: true, count: 1 };
}

export async function sendEncryptMessage(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: encryptInPage,
  });
  return injection?.result;
}


async function clickSaveInPage() {
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const button = [...document.querySelectorAll('#save, input[name="save"], button, input[type="submit"], input[type="button"], [role="button"]')].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
    return (element.id === "save" || element.name === "save" || label === "save")
      && !element.disabled
      && isVisible(element);
  });

  if (!button) {
    return { ok: false, count: 0, message: "No Save button was found on this page." };
  }

  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  return { ok: true, count: 1 };
}

export async function sendSaveMessage(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: "save" });
    // The content script can be present while its action module failed to
    // register (for example, during navigation or a partial script injection).
    // In that case, use the same direct page action as when no receiver exists.
    if (!response?.message?.includes('No content-script handler is registered for action "save"')) {
      return response;
    }
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) {
      throw error;
    }
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: clickSaveInPage,
  });
  return result?.result;
}
