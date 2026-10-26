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
  if (el.closest("[hidden]")) return false;

  let current = el;
  while (current instanceof Element) {
    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) return false;
    current = current.parentElement;
  }

  return true;
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

function fakeFillPage() {
  const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
  const randomDigits = (length) => Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
  const randomDate = () => {
    const start = new Date(1980, 0, 1).getTime();
    const end = new Date(2003, 11, 31).getTime();
    return new Date(start + Math.random() * (end - start)).toISOString().slice(0, 10);
  };
  const setValue = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const visible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  };

  const candidates = [...document.querySelectorAll("input, textarea, select")]
    .filter((element) => !element.disabled && !element.readOnly && visible(element));
  const radios = new Map();
  let count = 0;

  for (const element of candidates) {
    if (element instanceof HTMLSelectElement) {
      const options = [...element.options].filter((option) => !option.disabled && option.value !== "");
      if (options.length) {
        setValue(element, randomItem(options).value);
        count += 1;
      }
      continue;
    }
    if (element instanceof HTMLTextAreaElement) {
      setValue(element, `Copy Attached ${randomDigits(4)}`);
      count += 1;
      continue;
    }

    const type = (element.type || "text").toLowerCase();
    let value;
    switch (type) {
      case "hidden":
      case "button":
      case "submit":
      case "reset":
      case "image":
      case "file":
      case "password":
        continue;
      case "checkbox":
        element.checked = Math.random() >= 0.5;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        count += 1;
        continue;
      case "radio": {
        const key = element.name || `radio-${candidates.indexOf(element)}`;
        if (!radios.has(key)) radios.set(key, []);
        radios.get(key).push(element);
        continue;
      }
      case "email":
        value = `user${randomDigits(5)}@example.com`;
        break;
      case "tel":
        value = `01${randomDigits(9)}`;
        break;
      case "number":
      case "range": {
        const min = element.min !== "" && Number.isFinite(Number(element.min)) ? Number(element.min) : 0;
        const max = element.max !== "" && Number.isFinite(Number(element.max)) ? Number(element.max) : min + 100;
        const step = Number(element.step) > 0 ? Number(element.step) : 1;
        const steps = Math.max(0, Math.floor((max - min) / step));
        value = String(min + Math.floor(Math.random() * (steps + 1)) * step);
        break;
      }
      case "date":
        value = randomDate();
        break;
      case "month":
        value = `${1980 + Math.floor(Math.random() * 30)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}`;
        break;
      case "time":
        value = `${String(Math.floor(Math.random() * 24)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
        break;
      case "datetime-local":
        value = `${randomDate()}T${String(Math.floor(Math.random() * 24)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
        break;
      case "url":
        value = `https://example.com/${randomDigits(5)}`;
        break;
      case "color":
        value = `#${Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
        break;
      case "search":
        value = `Sample ${randomItem(["search", "query", "term"])} ${randomDigits(3)}`;
        break;
      case "text":
        value = `Copy Attached ${randomDigits(4)}`;
        break;
      default:
        value = `Sample ${randomItem(["name", "value", "text"])} ${randomDigits(4)}`;
    }
    setValue(element, value);
    count += 1;
  }

  for (const group of radios.values()) {
    const radio = randomItem(group);
    radio.checked = true;
    radio.dispatchEvent(new Event("input", { bubbles: true }));
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    count += 1;
  }
  return { ok: count > 0, count, message: count ? undefined : "No fillable fields were found on this page." };
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

async function waitForButton(getButton, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const button = getButton();
    if (button) return button;
    await wait(250);
  }
  return getButton();
}

const PENDING_DECRYPT_KEY = "pendingDecryptNavigation";
const PENDING_ENCRYPT_AND_SAVE_KEY = "pendingEncryptAndSave";
const PENDING_SIGN_ENCRYPT_SAVE_KEY = "pendingSignEncryptSave";

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
    const instructionDialog = document
      .querySelector("#encrypt-dialog-message")
      ?.closest(".ui-dialog");
    const instructionOk = instructionDialog
      ? [...instructionDialog.querySelectorAll(".ui-dialog-buttonpane button, button")].find((element) => {
        const label = (element.innerText || element.value || "").trim().toLowerCase();
        return label === "ok" && !element.disabled && isVisible(element);
      })
      : null;
    if (instructionOk) {
      const form = document.getElementById("frmBidSubmit");
      let actionField = document.getElementById("action") || document.querySelector('input[name="action"]');
      if (!actionField && form) {
        actionField = document.createElement("input");
        actionField.type = "hidden";
        actionField.id = "action";
        actionField.name = "action";
        form.appendChild(actionField);
      } else if (actionField && !actionField.id) {
        actionField.id = "action";
      }
      if (actionField && form && !form.contains(actionField)) form.appendChild(actionField);

      if (!actionField || !form || !form.contains(actionField)) {
        console.warn("[Encrypt] Could not prepare the Encrypt And Save action field.");
        return false;
      }

      instructionOk.click();
      console.log('[Encrypt] Accepted the encryption instructions; the page will encrypt and submit the form.');
      return "submit";
    }

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
async function fillAndVerifyDecryptPassword({ queueEncrypt = true } = {}) {
  let password;
  try {
    password = (await chrome.storage.local.get("encryptPassword"))?.encryptPassword;
  } catch (error) {
    console.warn("[Encrypt] Could not read saved password:", error);
    return false;
  }

  if (!password) return false;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const input = document.querySelector(
      '#myPanelDiv input#password, #myPanelDiv input[name="password"], #dialog-form input#password, #dialog-form input[name="password"]',
    );
    if (input && isVisible(input)) {
      setNativeValue(input, password);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const dialog = input.closest(".ui-dialog") || input.closest("#myPanelDiv, #dialog-form");
      const verifyButton = [...(dialog?.querySelectorAll("button, input[type=\"button\"], input[type=\"submit\"]") || [])].find((element) => {
        const label = (element.innerText || element.value || "").trim().toLowerCase();
        return label === "verify password" && !element.disabled && isVisible(element);
      });
      if (verifyButton) {
        if (queueEncrypt) {
          await chrome.storage.local.set({
            [PENDING_ENCRYPT_AND_SAVE_KEY]: { createdAt: Date.now() },
          });
        }
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

async function encryptAndSave({ persistPending = true } = {}) {
  const button = await waitForButton(getEncryptAndSaveButton);

  if (!button) {
    return { ok: false, count: 0, message: "No Encrypt And Save button was found on this page." };
  }

  if (persistPending) {
    await chrome.storage.local.set({
      [PENDING_ENCRYPT_AND_SAVE_KEY]: { createdAt: Date.now() },
    });
  }
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  console.log("[Encrypt] Clicked Encrypt And Save.");
  const confirmation = await clickEncryptConfirmationOk();
  return {
    ok: true,
    count: 1,
    confirmed: Boolean(confirmation),
    willSubmit: confirmation === "submit",
  };
}
async function signAndVerify({ queueEncrypt = true } = {}) {
  const button = await waitForButton(getSignButton);
  if (!button) {
    return { ok: false, verified: false, message: "No Sign button was found on this page." };
  }

  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  const verified = await fillAndVerifyDecryptPassword({ queueEncrypt });
  return verified
    ? { ok: true, verified: true, count: 1 }
    : { ok: true, verified: false, count: 1, message: "Sign clicked, but the password dialog was not ready." };
}

async function runPendingSignEncryptSave() {
  const signResult = await signAndVerify({ queueEncrypt: false });
  if (!signResult.ok || !signResult.verified) {
    console.warn("[Encrypt] Could not complete Sign before Encrypt:", signResult.message);
    return;
  }

  await wait(2000);
  const encryptResult = await encryptAndSave({ persistPending: false });
  if (!encryptResult.ok || !encryptResult.confirmed) {
    console.warn("[Encrypt] Could not complete Encrypt and Save:", encryptResult.message);
    return;
  }

  console.log("[Encrypt] Completed the requested Sign, Encrypt and Save flow.");
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
  }))); for (let attempt = 0; attempt < 240; attempt += 1) {
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
  const pendingSignEncryptSave = (await chrome.storage.local.get(PENDING_SIGN_ENCRYPT_SAVE_KEY))?.[PENDING_SIGN_ENCRYPT_SAVE_KEY];
  if (pendingSignEncryptSave) {
    await chrome.storage.local.remove(PENDING_SIGN_ENCRYPT_SAVE_KEY);
    if (Date.now() - pendingSignEncryptSave.createdAt <= 120000) {
      console.log("[Encrypt] Resuming the requested Sign, Encrypt and Save flow after navigation.");
      await runPendingSignEncryptSave();
      return;
    }
  }

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

function getEncryptButton() {
  return [...document.querySelectorAll('input#encrypt, input[name="encrypt"], input[type="button"]')].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return (element.id === "encrypt" || element.name === "encrypt" || label === "encrypt") && !element.disabled && isVisible(element);
  });
}

async function onlyEncrypt() {
  const encryptButton = await waitForButton(getEncryptButton);
  if (!encryptButton) {
    return { ok: false, verified: false, message: "No enabled Encrypt button appeared within 10 seconds." };
  }

  encryptButton.scrollIntoView({ block: "center", behavior: "smooth" });
  // This button require direct click like this. Not dispatch event.
  encryptButton.click();
  return { ok: true, count: 1 };
}

async function onlySave() {
  const saveButton = await waitForButton(getSaveButton);
  if (!saveButton) {
    return { ok: false, verified: false, message: "No enabled Save button appeared within 10 seconds." };
  }

  saveButton.scrollIntoView({ block: "center", behavior: "smooth" });
  saveButton.click();
  return { ok: true, count: 1 };
}

// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // These actions are handled by parser.js. Avoid answering them here so the
  // parser's response is the one returned to the extension UI.
  if (["parse", "setParsedFieldValue", "highlightParsedField"].includes(message.action)) {
    return false;
  }

  if (message.action === "applyRule") {
    applyRule(message.rule);
  }

  if (message.action === "applyAllRules") {
    chrome.storage.local.get("rules", (res) => {
      applyRules(res.rules || []);
    });
  }

  if (message.action === "fakeFill") {
    sendResponse(fakeFillPage());
    return false;
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
    clickDecryptAndVerify().then((ok) => {
      if (ok) {
        sendResponse({ ok: true, count: 1 })
      } else {
        sendResponse({ ok: false, message: "The password dialog was not ready." })
      }
    });
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

  if (message.action === "onlyEncrypt") {
    onlyEncrypt().then(sendResponse);
    return true;
  }

  if (message.action === "onlySave") {
    onlySave().then(sendResponse);
    return true;
  }

  if (message.action === "save") {
    save().then(sendResponse);
    return true;
  }

  sendResponse({ ok: true });
  return false;
});
