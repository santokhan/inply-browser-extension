/**
 * Parses a single form element (input, textarea, or select) from an HTML string.
 *
 * @param {string} htmlString - Raw HTML string containing exactly one form element.
 * @returns {object|null} Parsed element data or null if invalid input.
 *
 * @example
 * const html = '<input type="text" name="username" id="user1" class="form-control">';
 * const result = parseFormElements(html);
 *
 * console.log(result);
 * // {
 * //   tagName: "input",
 * //   id: "user1",
 * //   name: "username",
 * //   className: "form-control",
 * //   attributes: { type: "text", name: "username", id: "user1", class: "form-control" },
 * //   type: "text"
 * // }
 */
export function parseFormElement(htmlString) {
  const doc = new DOMParser().parseFromString(htmlString, "text/html");

  const elements = doc.querySelectorAll("input, textarea, select");

  if (elements.length !== 1) {
    console.error("Only 1 element is allowed.");
    return null;
  };

  const [el] = elements; // Take the first element

  const tagName = el.tagName.toLowerCase();

  // collect all attributes dynamically
  const attributes = {};

  for (const attr of el.attributes) {
    attributes[attr.name] = attr.value;
  }

  const data = {
    tagName,
    id: el.id,
    name: el.name,
    className: el.className,
    onblur: attributes.onblur,
  }

  if (tagName === "input") data.type = el.type;

  return data;
}