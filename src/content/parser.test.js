import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import { ltmTenderForms } from "../data/ltmTenderForms.js";

const source = readFileSync(new URL("./parser.js", import.meta.url), "utf8");

function page(title, count, selectOptions) {
  class Input {
    value = "original";
    events = [];
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
  runInContext(source, context);
  runInContext("getCurrentParsedFields = () => fields", context);
  return { fields, fill: (key) => handlers.get("fillLtmForm")({ formKey: key, form: ltmTenderForms.forms[key] }) };
}

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
