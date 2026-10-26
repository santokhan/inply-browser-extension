const FIELD_SELECTOR = [
  "input:not([type])",
  'input[type="text"]',
  'input[type="number"]',
  'input[type="date"]',
  "select",
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

function buildFieldSelector(field) {
  const tagName = field.tagName.toLowerCase();
  const classes = [...field.classList]
    .map((className) => `.${CSS.escape(className)}`)
    .join("");
  let selector = `${tagName}${classes}`;

  if (field.name) {
    const match = field.name.match(/^row\d+_(\d+)_(\d+)$/);
    if (match) {
      selector += `[name^="row"][name$="_${match[1]}_${match[2]}"]`;
    } else {
      selector += `[name="${CSS.escape(field.name)}"]`;
    }
  } else if (field.id) {
    selector += `[id="${CSS.escape(field.id)}"]`;
  }

  selector += ':not([type="hidden"])';
  if (field instanceof HTMLInputElement && field.type) {
    selector += `[type="${CSS.escape(field.type)}"]`;
  }

  return selector;
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

function getFieldSignature(field) {
  return [
    field.tagName.toLowerCase(),
    field.id || "",
    field.name || "",
    typeof field.className === "string" ? field.className : "",
    field instanceof HTMLInputElement ? field.type : "",
  ].join("|");
}

function getCurrentParsedFields() {
  const candidates = getCandidates();
  const container = findCommonAncestor(candidates.map((candidate) => candidate.table));
  return getValidInputFields(container, candidates);
}

function getParsedField(fieldKey) {
  const parsed = parsedFieldsByKey.get(fieldKey);
  if (!parsed) return null;

  const currentFields = getCurrentParsedFields();
  if (parsed.field?.isConnected && currentFields.includes(parsed.field)) {
    return parsed.field;
  }

  const sameSignature = currentFields.filter(
    (field) => getFieldSignature(field) === parsed.signature,
  );
  const replacement = sameSignature[parsed.signatureIndex];
  if (replacement) {
    parsed.field = replacement;
    return replacement;
  }

  const fieldAtOriginalIndex = currentFields[parsed.fieldIndex];
  if (fieldAtOriginalIndex && getFieldSignature(fieldAtOriginalIndex) === parsed.signature) {
    parsed.field = fieldAtOriginalIndex;
    return fieldAtOriginalIndex;
  }

  return null;
}

function getFieldLabel(field) {
  const row = field.closest("tr");
  if (!row) return "";

  const cells = [...row.cells];
  const headerCells = cells.filter(
    (cell) => cell.tagName === "TH" && cell.textContent.trim(),
  );
  if (!headerCells.length) return "";

  const fieldCell = field.closest("td, th");
  const fieldCellIndex = cells.indexOf(fieldCell);
  const precedingHeaders = headerCells.filter((cell) => cells.indexOf(cell) < fieldCellIndex);
  const header = precedingHeaders.at(-1) || headerCells[0];

  return (header.innerText || header.textContent).replace(/\s+/g, " ").trim();
}

// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "parse") {
    const candidates = getCandidates();

    const container = findCommonAncestor(candidates.map((candidate) => candidate.table));

    const validFieldElements = getValidInputFields(container, candidates);
    const signatureCounts = new Map();
    const validFields = validFieldElements.map((field, fieldIndex) => {
      const fieldKey = `${Date.now()}-${nextParsedFieldKey++}`;
      const signature = getFieldSignature(field);
      const signatureIndex = signatureCounts.get(signature) || 0;
      signatureCounts.set(signature, signatureIndex + 1);
      parsedFieldsByKey.set(fieldKey, { field, fieldIndex, signature, signatureIndex });
      const selector = buildFieldSelector(field);
      const matches = [...document.querySelectorAll(selector)].filter(isVisible);
      return {
      label: getFieldLabel(field),
      tagName: field.tagName.toLowerCase(),
      id: field.id,
      name: field.name,
      className: typeof field.className === "string" ? field.className : "",
      type: field instanceof HTMLInputElement ? field.type : undefined,
      options: field instanceof HTMLSelectElement
        ? [...field.options].map((option) => ({
            value: option.value,
            label: (option.label || option.textContent || "").replace(/\s+/g, " ").trim(),
            disabled: option.disabled,
          }))
        : undefined,
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
        : field instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
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
