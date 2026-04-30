function getElements(rule) {
  if (!rule?.selector) return [];

  const selectors = {
    name: `[name="${CSS.escape(rule.selector)}"]`,
    id: `#${CSS.escape(rule.selector)}`,
    class: `.${CSS.escape(rule.selector)}`
  };

  const selector = selectors[rule.type] || rule.selector;

  return document.querySelectorAll(selector);
}