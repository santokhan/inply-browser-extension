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
  let elements;
  try {
    elements = [...document.querySelectorAll(rule?.selector)].filter(displayNoneFilter);
  } catch (error) {
    console.warn("Invalid selector for rule:", rule, error);
    return { ok: false, message: "The saved rule selector is invalid." };
  }
  const element = elements[rule?.nth ?? 0];

  if (!element) {
    console.warn("Element not found for rule:", rule);
    return { ok: false, message: "No matching input was found on this page." };
  }

  setNativeValue(element, rule.value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true };
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
  if (await window.InplySignEncryptSave?.resumePendingSignEncryptSave()) return;

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

const messageHandlers = new Map();
window.InplyContentRouter = {
  register(actions, handler) {
    for (const action of Array.isArray(actions) ? actions : [actions]) {
      messageHandlers.set(action, handler);
    }
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers.get(message.action);
  if (!handler) {
    sendResponse({ ok: true });
    return false;
  }

  try {
    const result = handler(message, sender);
    if (result && typeof result.then === "function") {
      result.then(sendResponse).catch((error) => {
        console.error(`[Content] Action ${message.action} failed:`, error);
        sendResponse({ ok: false, message: error?.message || "The page action failed." });
      });
      return true;
    }
    sendResponse(result === undefined ? { ok: true } : result);
    return false;
  } catch (error) {
    console.error(`[Content] Action ${message.action} failed:`, error);
    sendResponse({ ok: false, message: error?.message || "The page action failed." });
    return false;
  }
});

window.InplyContentRouter.register("applyRule", (message) => applyRule(message.rule));
window.InplyContentRouter.register("applyAllRules", async () => {
  const result = await chrome.storage.local.get("rules");
  applyRules(result.rules || []);
  return { ok: true };
});
window.InplyContentRouter.register("fakeFill", () => fakeFillPage());
window.InplyContentRouter.register("startInspect", (message) => startInspect(message.rule));
window.InplyContentRouter.register("stopInspect", (message) => stopInspect(message.rule));
window.InplyContentRouter.register("encryptAnchors", (message) => encryptAnchors(message.password));
window.InplyContentRouter.register("decryptAnchors", () => decryptAnchors());
window.InplyContentRouter.register("decryptAndEncryptSave", async () => {
  const ok = await clickDecryptAndVerify();
  return ok
    ? { ok: true, count: 1 }
    : { ok: false, message: "The password dialog was not ready." };
});
