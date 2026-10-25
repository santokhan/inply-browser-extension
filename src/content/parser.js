const FIELD_SELECTOR = [
  "input:not([type])",
  'input[type="text"]',
  'input[type="number"]',
  'input[type="date"]',
  "textarea",
].join(", ");
const parsedFieldOutlines = new WeakMap();
const parsedFieldsByKey = new Map();
let nextParsedFieldKey = 0;

function isVisible(element) {
  if (element.closest("[hidden]")) return false;

  let current = element;

  while (current instanceof Element) {
    const style = getComputedStyle(current);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) {
      return false;
    }

    current = current.parentElement;
  }

  return true;
}

function getTableFields(table) {
  return [...table.querySelectorAll(FIELD_SELECTOR)].filter(
    (field) =>
      field.closest("table") === table &&
      isVisible(field) &&
      !field.readOnly &&
      !field.matches(":disabled"),
  );
}

function getCandidates() {
  const tables = document.querySelectorAll("table");

  const candidates = [...tables].map((table) => ({
    table,
    fields: getTableFields(table),
    wrapper: table.closest("form"),
  })).filter((candidate) => candidate.fields.length > 0);

  return candidates
}

function findCommonAncestor(elements = []) {
  if (!elements.length) return null;

  let ancestor = elements[0];

  while (ancestor) {
    if (elements.every((el) => ancestor.contains(el))) {
      return ancestor;
    }

    ancestor = ancestor.parentElement;
  }

  return null
}

// 1. Collect validated fields
function getValidInputFields(container, candidates = []) {
  if (!container) return [];

  const fields = candidates
    .filter(({ table }) => container.contains(table))
    .flatMap(({ fields }) => fields);

  return [...new Set(fields)];
}

function getParsedField(fieldKey) {
  const field = parsedFieldsByKey.get(fieldKey);
  if (!field?.isConnected) {
    parsedFieldsByKey.delete(fieldKey);
    return null;
  }
  return field;
}

// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "parse") {
    const candidates = getCandidates();

    const container = findCommonAncestor(candidates.map((candidate) => candidate.table));

    const validFields = getValidInputFields(container, candidates).map((field) => {
      const fieldKey = `${Date.now()}-${nextParsedFieldKey++}`;
      parsedFieldsByKey.set(fieldKey, field);
      const tagName = field.tagName.toLowerCase();
      const selector = field.id
        ? `#${CSS.escape(field.id)}`
        : field.name
          ? `${tagName}[name="${CSS.escape(field.name)}"]`
          : `${tagName}${[...field.classList].map((className) => `.${CSS.escape(className)}`).join("")}`;
      const matches = [...document.querySelectorAll(selector)].filter(isVisible);
      return {
      tagName: field.tagName.toLowerCase(),
      id: field.id,
      name: field.name,
      className: typeof field.className === "string" ? field.className : "",
      type: field instanceof HTMLInputElement ? field.type : undefined,
      onblur: field.getAttribute("onblur") || undefined,
      selector,
      nth: matches.indexOf(field),
      fieldKey,
    };
    });

    sendResponse(validFields);

    return true;
  }

  if (message.action === "highlightParsedField") {
    const field = getParsedField(message.fieldKey);
    if (field) {
      if (message.focused) {
        if (!parsedFieldOutlines.has(field)) {
          parsedFieldOutlines.set(field, {
            outline: field.style.outline,
            outlineOffset: field.style.outlineOffset,
            boxShadow: field.style.boxShadow,
          });
        }
        field.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        field.style.setProperty("outline", "2px solid #6366f1", "important");
        field.style.setProperty("outline-offset", "2px", "important");
        field.style.setProperty("box-shadow", "0 0 0 4px rgb(99 102 241 / 25%)", "important");
      } else {
        const original = parsedFieldOutlines.get(field);
        if (original) {
          field.style.outline = original.outline;
          field.style.outlineOffset = original.outlineOffset;
          field.style.boxShadow = original.boxShadow;
          parsedFieldOutlines.delete(field);
        }
      }
    }
    sendResponse({ ok: Boolean(field) });
    return false;
  }

  if (message.action === "setParsedFieldValue") {
    const field = getParsedField(message.fieldKey);

    if (field) {
      const value = message.value ?? "";
      const prototype = field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) setter.call(field, value);
      else field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
    sendResponse({ ok: Boolean(field) });
    return false;
  }

  return false;
});
