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

function getSignButton() {
  return [...document.querySelectorAll('#sign, input[name="sign"], button, input[type="button"], input[type="submit"], [role="button"]')].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "").trim().toLowerCase();
    return (element.id === "sign" || element.name === "sign" || label === "sign") && !element.disabled && isVisible(element);
  });
}
function getSaveButton() {
  return [...document.querySelectorAll('#save, input[name="save"], button, input[type="submit"], input[type="button"], [role="button"]')].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
    return (element.id === "save" || element.name === "save" || label === "save") && !element.disabled && isVisible(element);
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
const PENDING_ENCRYPT_AND_SAVE_KEY = "pendingEncryptAndSave";

function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function getDecryptButton() {
  return [...document.querySelectorAll(
    '#decrypt, button, input[type="button"], input[type="submit"], [role="button"]'
  )].find((element) => {
    const label = (element.innerText || element.value || "").trim().toLowerCase();
    return label === "decrypt" && !element.disabled && isVisible(element);
  });
}
// console.log(getDecryptButton());
function getEncryptAndSaveButton() {
  return [...document.querySelectorAll(
    '#encrypt, input[name="encrypt"], button, input[type="button"], input[type="submit"], [role="button"]'
  )].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return (label === "encrypt and save" || label === "encrypt") && !element.disabled && isVisible(element);
  });
}

async function clickEncryptConfirmationOk() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const okButton = [...document.querySelectorAll("#myPanelDiv button, #myPanelDiv input[type=\"button\"], #myPanelDiv input[type=\"submit\"]")].find((element) => {
      const label = (element.innerText || element.value || "").trim().toLowerCase();
      return label === "ok" && !element.disabled && isVisible(element);
    });
    if (okButton) {
      okButton.click();
      console.log("[Encrypt] Clicked Encrypt confirmation Ok.");
      return true;
    }
    await wait(250);
  }
  return false;
}
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
        await chrome.storage.local.set({
          [PENDING_ENCRYPT_AND_SAVE_KEY]: { createdAt: Date.now() },
        });
        verifyButton.click();
        console.log("[Encrypt] Filled and verified the saved password.");
        return true;
      }
    }
    await wait(250);
  }
  return false;
}

async function autoClickPendingEncryptAndSave() {
  let pending;

  try {
    pending = (await chrome.storage.local.get(PENDING_ENCRYPT_AND_SAVE_KEY))?.[PENDING_ENCRYPT_AND_SAVE_KEY];
  } catch (error) {
    console.warn("[Encrypt] Could not check for pending Encrypt And Save:", error);
    return;
  }

  if (!pending || Date.now() - pending.createdAt > 60000) {
    if (pending) await chrome.storage.local.remove(PENDING_ENCRYPT_AND_SAVE_KEY);
    return;
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const button = getEncryptAndSaveButton();
    if (button) {
      await chrome.storage.local.remove(PENDING_ENCRYPT_AND_SAVE_KEY);
      button.scrollIntoView({ block: "center", behavior: "smooth" });
      button.click();
      console.log("[Encrypt] Automatically clicked Encrypt And Save.");
      await clickEncryptConfirmationOk();
      return;
    }
    await wait(250);
  }

  await chrome.storage.local.remove(PENDING_ENCRYPT_AND_SAVE_KEY);
}
async function clickDecryptAndVerify() {
  const button = getDecryptButton();
  if (!button) return false;
  await chrome.storage.local.set({
    [PENDING_ENCRYPT_AND_SAVE_KEY]: { createdAt: Date.now() },
  });
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  const verified = await fillAndVerifyDecryptPassword();
  if (verified) {
    await autoClickPendingEncryptAndSave();
  }
  return verified;
}

async function decryptAnchors() {
  const button = getDecryptButton();

  if (!button) {
    return { ok: false, count: 0, message: "No decrypted links were found on this page." };
  }

  await chrome.storage.local.set({
    [PENDING_ENCRYPT_AND_SAVE_KEY]: { createdAt: Date.now() },
  });
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  console.log("[Encrypt] Clicked Decrypt.");
  return { ok: true, count: 1 };
}

async function encryptAndSave() {
  const button = getEncryptAndSaveButton();

  if (!button) {
    return { ok: false, count: 0, message: "No Encrypt And Save button was found on this page." };
  }

  await chrome.storage.local.set({
    [PENDING_ENCRYPT_AND_SAVE_KEY]: { createdAt: Date.now() },
  });
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  console.log("[Encrypt] Clicked Encrypt And Save.");
  const confirmed = await clickEncryptConfirmationOk();
  return { ok: true, count: 1, confirmed };
}
async function signAndVerify() {
  const button = getSignButton();
  if (!button) {
    return { ok: false, verified: false, message: "No Sign button was found on this page." };
  }

  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  const verified = await fillAndVerifyDecryptPassword();
  return verified
    ? { ok: true, verified: true, count: 1 }
    : { ok: true, verified: false, count: 1, message: "Sign clicked, but the password dialog was not ready." };
}
async function save() {
  const button = getSaveButton();
  if (!button) {
    return { ok: false, count: 0, message: "No Save button was found on this page." };
  }
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  console.log("[Save] Clicked Save; the page chkValidate handler is running.");
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

  if (!pending || Date.now() - pending.createdAt > 120000) return;

  // The decrypt control may be rendered after document_idle, so wait briefly.
  console.log("[Encrypt] Initial Decrypt button scan:", [...document.querySelectorAll("#decrypt, button, input[type=\"button\"], input[type=\"submit\"], [role=\"button\"]")].map((element) => ({
    tag: element.tagName,
    id: element.id,
    name: element.getAttribute("name"),
    text: (element.innerText || element.value || "").trim(),
    disabled: element.disabled,
    visible: isVisible(element),
  })));  for (let attempt = 0; attempt < 240; attempt += 1) {
    const button = getDecryptButton();
    if (button) {
      console.log("[Encrypt] Decrypt candidate found:", {
        tag: button.tagName,
        id: button.id,
        name: button.getAttribute("name"),
        text: (button.innerText || button.value || "").trim(),
        disabled: button.disabled,
        visible: isVisible(button),
      });
      const completed = await clickDecryptAndVerify();
      if (completed) {
        await chrome.storage.local.remove(PENDING_DECRYPT_KEY);
        console.log("[Encrypt] Automatically completed Decrypt and password verification.");
      } else {
        console.warn("[Encrypt] Could not complete Decrypt and password verification.");
      }
      return;
    }
    await wait(250);
  }

  console.warn("[Encrypt] No Decrypt button found after waiting on page:", {
    url: window.location.href,
    decryptElements: [...document.querySelectorAll("#decrypt, button, input[type=\"button\"], input[type=\"submit\"], [role=\"button\"]")].map((element) => ({
      tag: element.tagName,
      id: element.id,
      name: element.getAttribute("name"),
      text: (element.innerText || element.value || "").trim(),
      disabled: element.disabled,
      visible: isVisible(element),
    })),
  });
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
    anchor.target = "_self";
    anchor.scrollIntoView({ block: "center", behavior: "smooth" });
    anchor.click();
    count += 1;
    await wait(750);
  }

  return count
    ? { ok: true, count }
    : { ok: false, count: 0, message: "No encrypted links were found on this page." };
}
async function resumePendingEncryptFlow() {
  // Give the destination page time to finish rendering after Encrypt navigation.
  await wait(1000);
  const action = new URLSearchParams(window.location.search).get("action");
  const pending = (await chrome.storage.local.get(PENDING_DECRYPT_KEY))?.[PENDING_DECRYPT_KEY];
  console.log("[Encrypt] Page-load flow check:", {
    url: window.location.href,
    action,
    pendingDecrypt: Boolean(pending),
    pendingCreatedAt: pending?.createdAt || null,
  });

  // The destination can identify the flow by its URL even if storage startup races.
  if (pending || action === "Encrypt") {
    if (!pending && action === "Encrypt") {
      await chrome.storage.local.set({
        [PENDING_DECRYPT_KEY]: { createdAt: Date.now() },
      });
    }
    await autoClickPendingDecrypt();
  }

  await autoClickPendingEncryptAndSave();
}

resumePendingEncryptFlow();
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


  if (message.action === "decryptAndEncryptSave") {
    clickDecryptAndVerify().then((ok) => sendResponse(ok ? { ok: true, count: 1, confirmed: true } : { ok: false, message: "The password dialog was not ready." }));
    return true;
  }

  if (message.action === "encryptAndSave") {
    encryptAndSave().then(sendResponse);
    return true;
  }

  if (message.action === "signAndVerify") {
    signAndVerify().then(sendResponse);
    return true;
  }

  if (message.action === "save") {
    save().then(sendResponse);
    return true;
  }

  sendResponse({ ok: true });
  return false;
});