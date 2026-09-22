function setNativeValue(el, value) {
  const tag = el.tagName;

  if (tag === "INPUT") {
    const inputType = el.type?.toLowerCase();

    if (inputType === "checkbox" || inputType === "radio") {
      const normalized = String(value ?? "").toLowerCase();
      el.checked =
        normalized === "true" ||
        normalized === "1" ||
        normalized === "checked" ||
        normalized === "on";
      return;
    }

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    return;
  }

  if (tag === "TEXTAREA") {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    return;
  }

  if (tag === "SELECT") {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value"
    )?.set;

    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
  }
}

function displayNoneFilter(el) {
  return window.getComputedStyle(el).display !== "none"
}

function applyRule(rule) {
  const elements = [...document.querySelectorAll(rule?.selector)].filter(displayNoneFilter);
  const element = elements[rule?.nth || 0];

  if (!element) {
    console.warn("Element not found for rule:", rule);
    return;
  }

  setNativeValue(element, rule.value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyRules(rules) {
  rules.forEach(applyRule);
}

function startInspect(rule) {
  const elements = [...document.querySelectorAll(rule?.selector)].filter(displayNoneFilter);
  const element = elements[rule?.nth || 0];

  if (element) {
    element.style.setProperty("outline", "2px solid blue", "important");
    element.style.setProperty("background-color", "rgba(0,0,255,0.1)", "important");
  }
}

function stopInspect(rule) {
  const elements = [...document.querySelectorAll(rule?.selector)].filter(displayNoneFilter);
  const element = elements[rule?.nth || 0];

  if (element) {
    element.style.removeProperty("outline");
    element.style.removeProperty("background-color");
  }
}

function getFirstEncryptAnchor() {
  const anchors = [...document.querySelectorAll("a")];

  return anchors.find((anchor) => {
    return anchor instanceof HTMLAnchorElement &&
      anchor.href &&
      anchor.innerHTML.trim() === "Encrypt"
  });
}

function fillPasswordFields(password) {
  const fields = [...document.querySelectorAll('input[type="password"], input[name*="password" i]')];
  fields.forEach((field) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(field, password);
    else field.value = password;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const PENDING_DECRYPT_KEY = "pendingDecryptNavigation";

function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function getDecryptButton() {
  return [...document.querySelectorAll(
    'button, input[type="button"], input[type="submit"], [role="button"]'
  )].find((element) => {
    const label = (element.innerText || element.value || "").trim().toLowerCase();
    return label === "decrypt" && !element.disabled && isVisible(element);
  });
}
// console.log(getDecryptButton());

async function fillAndVerifyDecryptPassword() {
  let password;
  try {
    password = (await chrome.storage.local.get("encryptPassword"))?.encryptPassword;
  } catch (error) {
    console.warn("[Encrypt] Could not read saved password:", error);
    return false;
  }

  if (!password) return false;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const input = document.querySelector("#myPanelDiv input#password, #myPanelDiv input[name=\"password\"]");
    if (input && isVisible(input)) {
      setNativeValue(input, password);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const verifyButton = [...document.querySelectorAll("#myPanelDiv button, #myPanelDiv input[type=\"button\"], #myPanelDiv input[type=\"submit\"]")].find((element) => {
        const label = (element.innerText || element.value || "").trim().toLowerCase();
        return label === "verify password" && !element.disabled && isVisible(element);
      });
      if (verifyButton) {
        verifyButton.click();
        console.log("[Encrypt] Filled and verified the saved password.");
        return true;
      }
    }
    await wait(250);
  }
  return false;
}

async function clickDecryptAndVerify() {
  const button = getDecryptButton();
  if (!button) return false;
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  await fillAndVerifyDecryptPassword();
  return true;
}

async function decryptAnchors() {
  const button = getDecryptButton();

  if (!button) {
    return { ok: false, count: 0, message: "No decrypted links were found on this page." };
  }

  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  console.log("[Encrypt] Clicked Decrypt.");
  return { ok: true, count: 1 };
}

async function autoClickPendingDecrypt() {
  let pending;

  try {
    pending = (await chrome.storage.local.get(PENDING_DECRYPT_KEY))?.[PENDING_DECRYPT_KEY];
  } catch (error) {
    console.warn("[Encrypt] Could not check for pending decrypt:", error);
    return;
  }

  if (!pending || Date.now() - pending.createdAt > 30000) return;

  // The decrypt control may be rendered after document_idle, so wait briefly.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const button = getDecryptButton();
    if (button) {
      if (pending) await chrome.storage.local.remove(PENDING_DECRYPT_KEY);
      await clickDecryptAndVerify();
      console.log("[Encrypt] Automatically clicked Decrypt.");
      return;
    }
    await wait(250);
  }

  if (pending) await chrome.storage.local.remove(PENDING_DECRYPT_KEY);
}
async function encryptAnchors(password) {
  let count = 0;

  console.log("[Encrypt] Encrypt anchors on save and encrypt:", [...document.querySelectorAll("a")].filter(
    (anchor) =>
      anchor instanceof HTMLAnchorElement &&
      anchor.href &&
      anchor.innerHTML.trim() === "Encrypt"
  ));

  while (true) {
    const anchor = getFirstEncryptAnchor();
    console.log({ anchor });
    if (!anchor) break;

    console.log("[Encrypt] Clicking anchor:", anchor);
    fillPasswordFields(password);
    await chrome.storage.local.set({
      [PENDING_DECRYPT_KEY]: { createdAt: Date.now() },
    });
    anchor.scrollIntoView({ block: "center", behavior: "smooth" });
    anchor.click();
    count += 1;
    await wait(750);
  }

  return count
    ? { ok: true, count }
    : { ok: false, count: 0, message: "No encrypted links were found on this page." };
}
autoClickPendingDecrypt();

async function autoClickEncryptAction() {
  const action = new URLSearchParams(window.location.search).get("action");
  if (action !== "Encrypt") return;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const button = document.querySelector("#decrypt");
    if (button && !button.disabled && isVisible(button)) {
      button.scrollIntoView({ block: "center", behavior: "smooth" });
      button.click();
      console.log("[Encrypt] Automatically clicked #decrypt for action=Encrypt.");
      return;
    }
    await wait(250);
  }
}

autoClickEncryptAction();
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "applyRule") {
    applyRule(message.rule);
  }

  if (message.action === "applyAllRules") {
    chrome.storage.local.get("rules", (res) => {
      applyRules(res.rules || []);
    });
  }

  if (message.action === "startInspect") {
    startInspect(message.rule);
  }

  if (message.action === "stopInspect") {
    stopInspect(message.rule);
  }

  if (message.action === "encryptAnchors") {
    encryptAnchors(message.password).then(sendResponse);
    return true;
  }

  if (message.action === "decryptAnchors") {
    decryptAnchors().then(sendResponse);
    return true;
  }

  sendResponse({ ok: true });
  return false;
});