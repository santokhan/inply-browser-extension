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
    anchor.scrollIntoView({ block: "center", behavior: "smooth" });
    anchor.click();
    count += 1;
    await wait(750);
  }

  return count
    ? { ok: true, count }
    : { ok: false, count: 0, message: "No encrypted links were found on this page." };
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

  sendResponse({ ok: true });
  return false;
});