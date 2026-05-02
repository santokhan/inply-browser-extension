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

function applyRule(rule) {
  const element = Number(rule?.nth)
    ? document.querySelectorAll(rule?.selector)[rule?.nth]
    : document.querySelector(rule?.selector);

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

  sendResponse({ ok: true });
  return false;
});