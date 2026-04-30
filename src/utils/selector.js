export function getElementsForRule(rule) {
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