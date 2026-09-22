function parseRowName(name) {
  const match = name.match(/^row(\d+)_(\d+)_(\d+)$/);

  if (!match) return null;

  return {
    rowId: match[1],
    formId: match[2],
    fieldId: match[3],
  };
}

function buildRowSelector(attr, parsed) {
  if (!parsed) return null;

  const { rowId, formId, fieldId } = parsed;

  // Narrow + precise selector
  return `
    [${attr}^="row${rowId}"]
    [${attr}$="_${formId}_${fieldId}"]
  `.replace(/\s+/g, ""); // remove spaces
}

function parseSelector(attr, selectorValue, value) {
  const parsed = parseRowName(selectorValue);
  if (!parsed) return;

  const query = buildRowSelector(attr, parsed);

  document.querySelectorAll(query).forEach(el => {
    // works for input + textarea
    el.value = value;
  });
}

// Tenderer Information Form (Form e-PW2B-2) - Tender: A
parseSelector("id", "row2537485_1_1", "Copy Attached");
parseSelector("id", "row2537485_1_2", "Copy Attached");
parseSelector("id", "row2537486_1_1", "Copy Attached");
parseSelector("id", "row2537486_1_2", "Pubali Bank, Jamalpur");
parseSelector("id", "row2537486_1_3", "Copy Attached");
parseSelector("id", "row2537487_1_1", "Copy Attached");
parseSelector("id", "row2537487_1_2", "Copy Attached");
parseSelector("id", "row2537488_1_1", 1);
parseSelector("id", "row2537488_1_2", "Copy Attached");
parseSelector("id", "row2537488_1_3", "Copy Attached");
parseSelector("id", "row2537488_1_4", "Copy Attached");
parseSelector("id", "row2537488_1_5", "Copy Attached");

// Personnel Information (Form e-PW2B-3) - Tender: A
parseSelector("id", "row2537489_1_1", "Copy Attached");
parseSelector("id", "row2537489_1_2", "Copy Attached");
parseSelector("id", "row2537489_1_3", "Copy Attached");
parseSelector("id", "row2537489_1_4", "Copy Attached");
parseSelector("id", "row2537489_1_5", "Copy Attached");
parseSelector("id", "row2537489_1_6", "Copy Attached");

// Tenderer Information Form (Form e-PW2B-2) Tender: B
parseSelector("id", "row2537532_1_1", "Copy Attached");
parseSelector("id", "row2537532_1_2", "Copy Attached");
parseSelector("id", "row2537533_1_1", "Copy Attached");
parseSelector("id", "row2537533_1_2", "Pubali Bank, Jamalpur");
parseSelector("id", "row2537533_1_3", "Copy Attached");
parseSelector("id", "row2537534_1_1", "Copy Attached");
parseSelector("id", "row2537534_1_2", "Copy Attached");
parseSelector("id", "row2537534_1_3", "Copy Attached");
parseSelector("id", "row2537535_1_1", 1);
parseSelector("id", "row2537535_1_2", "Copy Attached");
parseSelector("id", "row2537535_1_3", "Copy Attached");
parseSelector("id", "row2537535_1_4", "Copy Attached");
parseSelector("id", "row2537535_1_5", "Copy Attached");

// Personnel Information (Form e-PW2B-3) Tender: B
parseSelector("id", "row2537537_1_1", "Copy Attached");
parseSelector("id", "row2537537_1_3", "Copy Attached");
parseSelector("id", "row2537537_1_4", "Copy Attached");
parseSelector("id", "row2537537_1_5", "Copy Attached");
parseSelector("id", "row2537537_1_6", "Copy Attached");
parseSelector("id", "row2537537_1_7", "Copy Attached");
parseSelector("id", "row2537538_1_1", "Copy Attached");
parseSelector("id", "row2537538_1_2", "Copy Attached");
parseSelector("id", "row2537538_1_3", "Copy Attached");
parseSelector("id", "row2537538_1_4", "Copy Attached");
parseSelector("id", "row2537538_1_5", "Copy Attached");
parseSelector("id", "row2537538_1_6", "Copy Attached");
parseSelector("id", "row2537538_1_7", "Copy Attached");
parseSelector("id", "row2537538_1_8", "Copy Attached");
parseSelector("id", "row2537539_1_2", 1);
parseSelector("id", "row2537539_1_3", "Copy Attached");
parseSelector("id", "row2537539_1_4", "Copy Attached");
parseSelector("id", "row2537539_1_5", "Copy Attached");
parseSelector("id", "row2537539_1_6", "Copy Attached");
parseSelector("id", "row2537539_1_7", "Copy Attached");

document.querySelectorAll('[name^="row"][name$="_1_1"]:not([type="hidden"]').forEach(el => {
  console.log(el);
});
document.querySelectorAll('[name^="row"][name$="_1_2"]:not([type="hidden"]').forEach(el => {
  console.log(el);
});
document.querySelectorAll('[name^="row"][name$="_1_3"]:not([type="hidden"]').forEach(el => {
  console.log(el);
});
document.querySelectorAll('[name^="row"][name$="_1_4"]:not([type="hidden"]').forEach(el => {
  console.log(el);
});
document.querySelectorAll('[name^="row"][name$="_1_5"]:not([type="hidden"]').forEach(el => {
  console.log(el);
})
document.querySelectorAll('[name^="row"][name$="_1_6"]:not([type="hidden"]').forEach(el => {
  console.log(el);
});
document.querySelectorAll('[name^="row"][name$="_1_7"]:not([type="hidden"]').forEach(el => {
  console.log(el);
});
document.querySelectorAll('[name^="row"][name$="_1_8"]:not([type="hidden"]').forEach(el => {
  console.log(el);
});

function openEncryptLinks() {
  const baseUrl = "https://www.eprocure.gov.bd/tenderer/";

  [...document.querySelectorAll('a[href^="BidForm.jsp"]')]
    .filter(a => a.textContent.trim() === "Encrypt")
    .forEach(a => {
      const url = new URL(a.getAttribute("href"), baseUrl).href;
      window.open(url, "_blank");
    });
}