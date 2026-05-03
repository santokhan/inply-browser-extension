/**
 * Parse row attribute value like: row2537537_1_3
 * This will only work for platform like EGP
 * @param {string} name
 * @returns {{ formId: number, fieldId: number } | string}
 */
export function parseAttributeValue(name = "") {
  if (typeof name !== "string") {
    console.warn("Invalid attribute value:", name);
    return "";
  };

  const match = name.match(/^row\d+_(\d+)_(\d+)$/);

  if (!match) return name;

  return {
    formId: Number(match[1]),
    fieldId: Number(match[2]),
  };
}

/**
 * Build selector for name/id attributes
 * @param {string} attrKey
 * @param {string} attrValue
 * @returns {string}
 */
function buildAttributeSelector(attrKey, attrValue) {
  const parsed = parseAttributeValue(attrValue);

  if (!parsed || typeof parsed !== "object") {
    return `[${attrKey}="${CSS.escape(attrValue)}"]`;
  }

  const { formId, fieldId } = parsed;

  let selector = `[${attrKey}^="row"]`;
  selector += `[${attrKey}$="_${formId}_${fieldId}"]`;

  return selector;
}

/**
 * Build a query selector for autofill rules
 *
 * Expected output format:
 * **tagName.className[name^="row"][name$="_<formId>_<fieldId>"]:not([type="hidden"])[type="email"]**
 *
 * @param {Object} element
 * @returns {string}
 */
export function buildQuerySelector(element = {}) {
  if (!element) return "";

  const {
    tagName,
    // id,
    name,
    className,
    type
  } = element;

  let selector = tagName.toLowerCase();

  // 2. className (can be multiple classes)
  if (className) {
    const classes = className
      .split(" ")
      .filter(Boolean)
      .map(c => `.${CSS.escape(c)}`)
      .join("");

    selector += classes;
  }

  // 3. name-based matching (important for form grouping)
  if (name) {
    selector += buildAttributeSelector('name', name);
  }

  // 4. always avoid hidden inputs
  selector += `:not([type="hidden"])`;

  // 5. type refinement (optional narrowing)
  if (type) {
    selector += `[type="${CSS.escape(type)}"]`;
  }

  return selector;
}