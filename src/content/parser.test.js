import assert from "node:assert/strict";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import { ltmTenderForms } from "../data/ltmTenderForms.js";
import { installPageParser } from "../utils/pageParser.js";

const source = installPageParser.toString().replace(
  "function getCurrentParsedFields() {",
  "function getCurrentParsedFields() { return fields;",
);

function page(title, count, selectOptions) {
  class Input {
    value = "original";
    events = [];
    style = {
      outline: "1px solid red", outlineOffset: "0px", boxShadow: "none",
      setProperty(name, value) {
        this[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      },
    };
    scrollIntoView() {}
    dispatchEvent(event) { this.events.push(event.type); }
  }
  class Select extends Input {
    options = selectOptions;
  }
  const fields = Array.from({ length: count }, () => selectOptions ? new Select() : new Input());
  const handlers = new Map();
  const context = createContext({
    window: { InplyContentRouter: { register: (key, handler) => handlers.set(key, handler) } },
    document: { body: { innerText: title } },
    HTMLInputElement: Input,
    HTMLSelectElement: Select,
    HTMLTextAreaElement: class extends Input {},
    Event: class { constructor(type) { this.type = type; } },
    fields,
  });
  runInContext(`(${source})();`, context);
  return {
    fields,
    fill: (key) => handlers.get("fillLtmForm")({ formKey: key, form: ltmTenderForms.forms[key] }),
    highlight: (key, section, field, focused = true) => handlers.get("highlightLtmField")({
      formKey: key, form: ltmTenderForms.forms[key], section, field, focused,
    }),
    edit: (key, section, field, value) => handlers.get("setLtmFieldValue")({
      formKey: key, form: ltmTenderForms.forms[key], section, field, value,
    }),
  };
}

test("editing an LTM value updates only its indexed webpage field and fires input/change", () => {
  const { fields, edit } = page("e-PW2B-2", 13);
  assert.equal(edit("tenderer_information", "financial_resources", "amount_available", "4500000").ok, true);
  assert.equal(fields[10].value, "4500000");
  assert.deepEqual(fields[10].events, ["input", "change"]);
  assert.ok(fields.every((field, index) => index === 10 || (field.value === "original" && field.events.length === 0)));
  assert.equal(edit("tenderer_information", "financial_resources", "amount_available", "").ok, true);
  assert.equal(fields[10].value, "");
});

test("live edits reject wrong pages, counts, and unknown field keys without changing values", () => {
  for (const [title, count, field] of [["Activity Form", 13, "name"], ["e-PW2B-2", 12, "name"], ["e-PW2B-2", 13, "unknown"]]) {
    const { fields, edit } = page(title, count);
    assert.equal(edit("tenderer_information", "personnel", field, "Edited").ok, false);
    assert.ok(fields.every((field) => field.value === "original" && field.events.length === 0));
  }
});

test("BOQ live edits resolve select labels and reject invalid options before any changes", () => {
  const { fields, edit } = page("Priced Bill of Quantities", 3, [{ value: "Y", label: "Yes" }]);
  assert.equal(edit("priced_bill_of_quantities", "select_fields", "all", "Yes").ok, true);
  assert.ok(fields.every((field) => field.value === "Y"));
  fields[2].options = [{ value: "N", label: "No" }];
  assert.equal(edit("priced_bill_of_quantities", "select_fields", "all", "No").ok, false);
  assert.ok(fields.every((field) => field.value === "Y"));
});

test("LTM hover maps section fields to page inputs and restores outlines on leave", () => {
  const { fields, highlight } = page("e-PW2B-2", 13);
  assert.equal(highlight("tenderer_information", "financial_resources", "amount_available").ok, true);
  assert.equal(fields[10].style.outline, "2px solid #6366f1");
  assert.equal(fields[0].style.outline, "1px solid red");
  assert.equal(highlight("tenderer_information", "personnel", "name").ok, true);
  assert.equal(fields[10].style.outline, "1px solid red");
  assert.equal(fields[1].style.outline, "2px solid #6366f1");
  highlight(null, null, null, false);
  assert.equal(fields[1].style.outline, "1px solid red");
  assert.ok(fields.every((field) => field.value === "original" && field.events.length === 0));
});

test("LTM hover ignores mismatched forms, counts, and unknown fields", () => {
  for (const [title, count, field] of [["Activity Form", 13, "name"], ["e-PW2B-2", 12, "name"], ["e-PW2B-2", 13, "unknown"]]) {
    const { fields, highlight } = page(title, count);
    assert.equal(highlight("tenderer_information", "personnel", field).ok, false);
    assert.ok(fields.every((field) => field.style.outline === "1px solid red"));
  }
});

test("BOQ All hover outlines every select and clears them on leave", () => {
  const { fields, highlight } = page("Priced Bill of Quantities", 3, []);
  assert.equal(highlight("priced_bill_of_quantities", "select_fields", "all").ok, true);
  assert.ok(fields.every((field) => field.style.outline === "2px solid #6366f1"));
  highlight(null, null, null, false);
  assert.ok(fields.every((field) => field.style.outline === "1px solid red"));
});

test("fills the expected table fields in preset order, including blank strings", () => {
  const { fields, fill } = page("Tenderer Information Form (Form e-PW2B-2)", 13);
  assert.equal(fill("tenderer_information").ok, true);
  assert.equal(fields[0].value, "1");
  assert.equal(fields[10].value, "3000000");
  assert.equal(fields[12].value, "");
  assert.deepEqual(fields[0].events, ["input", "change"]);
});

test("rejects mismatched form identity and counts without changing any fields", () => {
  for (const [title, count] of [["Activity Form", 13], ["e-PW2B-2", 12]]) {
    const { fields, fill } = page(title, count);
    assert.equal(fill("tenderer_information").ok, false);
    assert.ok(fields.every((field) => field.value === "original" && field.events.length === 0));
  }
});

test("BOQ resolves Yes labels to actual option values for every select", () => {
  const { fields, fill } = page("Priced Bill of Quantities (BOQ)", 3, [{ value: "Y", label: "Yes" }]);
  assert.equal(fill("priced_bill_of_quantities").ok, true);
  assert.ok(fields.every((field) => field.value === "Y"));
});

test("invalid select options reject the entire fill before any changes", () => {
  const { fields, fill } = page("Priced Bill of Quantities", 2, [{ value: "Y", label: "Yes" }]);
  fields[1].options = [{ value: "N", label: "No" }];
  assert.equal(fill("priced_bill_of_quantities").ok, false);
  assert.ok(fields.every((field) => field.value === "original"));
});

test("submission letter preserves existing contents when there are no presets", () => {
  const { fields, fill } = page("e-Tender Submission Letter (Form e-PW2B-1)", 1);
  assert.equal(fill("e_tender_submission_letter").ok, true);
  assert.equal(fields[0].value, "original");
});
