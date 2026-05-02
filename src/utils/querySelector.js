/**
 * Parse row attribute value like: row2537537_1_3
 * @param {string} name
 * @returns {{ formId: number, fieldId: number } | null}
 */
function parseRowName(name = "") {
  if (typeof name !== "string") return null;

  const match = name.match(/^row\d+_(\d+)_(\d+)$/);

  if (!match) return null;

  return {
    formId: Number(match[1]),
    fieldId: Number(match[2]),
  };
}

/**
 * Build selector for name/id attributes
 * @param {string} attrKey
 * @param {string} attrValue
 * @returns {string | null}
 */
function buildRowSelector(attrKey, attrValue) {
  const parsed = parseRowName(attrValue);
  if (!parsed) return null;

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
  
  const { tagName, id, name, className, type } = element;

  const tag = tagName?.toLowerCase();

  let selector = tagName;

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
    selector += buildRowSelector('name', name);
  }

  // 4. always avoid hidden inputs
  selector += `:not([type="hidden"])`;

  // 5. type refinement (optional narrowing)
  if (type) {
    selector += `[type="${CSS.escape(type)}"]`;
  }

  return selector;
}