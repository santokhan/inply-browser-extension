export function parseFormElements(htmlString) {
  const doc = new DOMParser().parseFromString(htmlString, "text/html");

  const elements = doc.querySelectorAll("input, textarea, select");

  return Array.from(elements).map(el => {
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
  });
}