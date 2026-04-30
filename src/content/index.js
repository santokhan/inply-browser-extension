function getElementsForRule(rule) {
  if (!rule || !rule.selector) return [];

  if (rule.type === "name") {
    return document.querySelectorAll(`[name="${CSS.escape(rule.selector)}"]`);
  }

  if (rule.type === "id") {
    return document.querySelectorAll(`#${CSS.escape(rule.selector)}`);
  }

  if (rule.type === "class") {
    return document.querySelectorAll(`.${CSS.escape(rule.selector)}`);
  }

  return document.querySelectorAll(rule.selector);
}

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
  const elements = getElementsForRule(rule);

  if (!elements.length) {
    console.warn("Element not found for rule:", rule);
    return;
  }

  elements.forEach((el) => {
    setNativeValue(el, rule.value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function applyRules(rules) {
  rules.forEach(applyRule);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "applyRule") {
    applyRule(message.rule);
  }

  if (message.action === "applyAllRules") {
    chrome.storage.local.get("rules", (res) => {
      applyRules(res.rules || []);
    });
  }
});
