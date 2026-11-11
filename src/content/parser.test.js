import assert from "node:assert/strict";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import { ltmTenderForms, restoreLtmForms } from "../data/ltmTenderForms.js";
import { installPageParser } from "../utils/pageParser.js";

const source = installPageParser.toString().replace(
  "function getCurrentParsedFields() {",
  "function getCurrentParsedFields() { return fields;",
);

function page(title, count, selectOptions, timers = { setTimeout }) {
  const interactions = [];
  class Input {
    value = "original";
    events = [];
    listeners = new Map();
    style = {
      outline: "1px solid red", outlineOffset: "0px", boxShadow: "none",
      setProperty(name, value) {
        this[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      },
    };
    scrollIntoView() {}
    focus() { interactions.push("focus"); }
    blur() {
      if (timers.nativeBlur !== false) this.dispatchEvent({ type: "blur" });
    }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    removeEventListener(type) { this.listeners.delete(type); }
    dispatchEvent(event) {
      this.events.push(event.type);
      interactions.push(event.type);
      this.listeners.get(event.type)?.(event);
    }
  }
  class Select extends Input {
    options = selectOptions;
  }
  const fields = Array.from({ length: count }, () => selectOptions ? new Select() : new Input());
  const elements = new Map();
  const bodyAttributes = new Map();
  const handlers = new Map();
  const context = createContext({
    window: { InplyContentRouter: { register: (key, handler) => handlers.set(key, handler) } },
    document: {
      body: {
        innerText: title,
        click: () => interactions.push("document click"),
        focus: () => interactions.push("document focus"),
        getAttribute: (name) => bodyAttributes.get(name) ?? null,
        setAttribute: (name, value) => bodyAttributes.set(name, value),
        removeAttribute: (name) => bodyAttributes.delete(name),
      },
      getElementById: (id) => elements.get(id),
    },
    setTimeout: timers.setTimeout,
    Date: timers.Date || Date,
    HTMLInputElement: Input,
    HTMLSelectElement: Select,
    HTMLTextAreaElement: class extends Input {},
    Event: class { constructor(type) { this.type = type; } },
    FocusEvent: class { constructor(type) { this.type = type; } },
    fields,
  });
  runInContext(`(${source})();`, context);
  return {
    fields,
    elements,
    bodyAttributes,
    interactions,
    select: (index, options) => {
      const field = new Select();
      field.options = options;
      fields[index] = field;
      return field;
    },
    fill: (key, form = ltmTenderForms.forms[key]) => handlers.get("fillLtmForm")({ formKey: key, form }),
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

function quotedPricePage(nativeBlur = true) {
  let now = 0;
  let nextCheck;
  const fixture = page("Tenderer's Quoted Price", 1, undefined, {
    Date: { now: () => now },
    nativeBlur,
    setTimeout: (callback) => { nextCheck = callback; },
  });
  fixture.fields[0].id = "row2820025_1_2";
  const outputs = ["1_3", "1_4", "2_3", "2_4"].map((suffix) => {
    const output = { value: "Previous calculation", readOnly: true };
    fixture.elements.set(`row2820025_${suffix}`, output);
    return output;
  });
  return {
    ...fixture,
    outputs,
    advance(milliseconds) { now += milliseconds; nextCheck(); },
  };
}

test("quoted price waits for delayed server outputs and a stable grand total before completing", async () => {
  const { fields, outputs, interactions, fill, advance } = quotedPricePage();
  let completed = false;
  const pending = fill("tenderers_quoted_price").then((result) => {
    completed = true;
    return result;
  });
  assert.equal(fields[0].value, "-5");
  assert.deepEqual(interactions, ["focus", "input", "change", "blur", "document focus", "document click"]);
  assert.ok(outputs.every((output) => output.value === ""));
  advance(2000);
  outputs[0].value = "1330000.000";
  outputs[1].value = "Thirteen lakh thirty thousand";
  advance(100);
  await Promise.resolve();
  assert.equal(completed, false);
  outputs[2].value = "1330000.000";
  outputs[3].value = "Thirteen lakh thirty thousand";
  advance(100);
  advance(200);
  await Promise.resolve();
  assert.equal(completed, false);
  outputs[3].value += " taka";
  advance(100);
  advance(200);
  await Promise.resolve();
  assert.equal(completed, false);
  advance(100);
  assert.equal((await pending).ok, true);
  assert.equal(completed, true);
});

test("quoted price stops the workflow if server outputs never finish", async () => {
  const { outputs, fill, advance } = quotedPricePage();
  const pending = fill("tenderers_quoted_price");
  outputs[0].value = "0";
  advance(30000);
  const result = await pending;
  assert.equal(result.ok, false);
  assert.match(result.message, /30 seconds/);
});

test("quoted price dispatches blur when native blur is suppressed and restores body tabindex", async () => {
  for (const tabIndex of [null, "0"]) {
    const { fields, bodyAttributes, interactions, fill, advance } = quotedPricePage(false);
    if (tabIndex !== null) bodyAttributes.set("tabindex", tabIndex);
    const pending = fill("tenderers_quoted_price");
    assert.deepEqual(interactions, ["focus", "input", "change", "document focus", "blur", "focusout", "document click"]);
    assert.equal(bodyAttributes.get("tabindex") ?? null, tabIndex);
    assert.equal(fields[0].events.filter((event) => event === "blur").length, 1);
    advance(30000);
    assert.equal((await pending).ok, false);
  }
});

test("quoted price reports missing calculation controls before triggering a request", () => {
  const { elements, fill, interactions } = quotedPricePage();
  elements.delete("row2820025_2_4");
  assert.equal(fill("tenderers_quoted_price").ok, false);
  assert.equal(interactions.includes("document click"), false);
});

test("rejects mismatched form identity and counts without changing any fields", () => {
  for (const [title, count] of [["Activity Form", 13], ["e-PW2B-2", 12]]) {
    const { fields, fill } = page(title, count);
    assert.equal(fill("tenderer_information").ok, false);
    assert.ok(fields.every((field) => field.value === "original" && field.events.length === 0));
  }
});

test("Activity Form accepts singular and plural page titles for filling, editing, and highlighting", () => {
  for (const title of ["Activity Form", "Activities Form", "  ACTIVITIES\n FORM  "]) {
    const { fields, fill, edit, highlight } = page(title, 2);
    assert.equal(fill("activity_form").ok, true);
    assert.deepEqual(fields.map((field) => field.value), ["5", "50"]);
    assert.equal(edit("activity_form", "activity", "activity_duration_days", "60").ok, true);
    assert.equal(fields[1].value, "60");
    assert.equal(highlight("activity_form", "activity", "duration_of_activity_start_days").ok, true);
    assert.equal(fields[0].style.outline, "2px solid #6366f1");
  }
});

test("Activity Form still rejects unrelated pages and incorrect field counts", () => {
  for (const [title, count] of [["Tenderer Information Form (Form e-PW2B-2)", 2], ["Activities Form", 3]]) {
    const { fields, fill, edit, highlight } = page(title, count);
    assert.equal(fill("activity_form").ok, false);
    assert.equal(edit("activity_form", "activity", "activity_duration_days", "60").ok, false);
    assert.equal(highlight("activity_form", "activity", "duration_of_activity_start_days").ok, false);
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

test("personnel presets fill the candidate dropdown using its label for new and older saves", () => {
  for (const stored of [{}, {
    personnel_information: { values: { candidate_details: { proposed_position_type: "Copy Enclosed" } } },
  }]) {
    const { fields, fill, select } = page("Personnel Information (Form e-PW2B-3)", 23);
    select(16, [{ value: "P", label: "Prime Candidate" }]);
    assert.equal(fill("personnel_information", restoreLtmForms(stored).personnel_information).ok, true);
    assert.equal(fields[16].value, "P");
    assert.equal(fields[15].value, "Copy Enclosed");
    assert.equal(fields[17].value, "Copy Enclosed");
    assert.ok(fields.every((field) => field.events.length === 2));
  }
});

test("restoring personnel values preserves a customized candidate type and other saved fields", () => {
  const stored = {
    personnel_information: { values: { candidate_details: {
      proposed_position_type: "Alternative Candidate", name: "Saved name",
    } } },
    activity_form: { values: { activity: { activity_duration_days: "60" } } },
  };
  const forms = restoreLtmForms(stored);
  assert.equal(forms.personnel_information.values.candidate_details.proposed_position_type, "Alternative Candidate");
  assert.equal(forms.personnel_information.values.candidate_details.name, "Saved name");
  assert.equal(forms.activity_form.values.activity.activity_duration_days, "60");
  assert.equal(forms.activity_form.values.activity.duration_of_activity_start_days, "5");
  assert.equal(stored.personnel_information.values.candidate_details.name, "Saved name");
});

test("invalid personnel candidate type names the field and allowed choices before changing any fields", () => {
  const { fields, fill, select } = page("Personnel Information (Form e-PW2B-3)", 23);
  select(16, [{ value: "A", label: "Alternative Candidate" }]);
  const result = fill("personnel_information");
  assert.equal(result.ok, false);
  assert.match(result.message, /proposed position type/);
  assert.match(result.message, /Alternative Candidate/);
  assert.ok(fields.every((field) => field.value === "original" && field.events.length === 0));
});

test("submission letter preserves existing contents when there are no presets", () => {
  const { fields, fill } = page("e-Tender Submission Letter (Form e-PW2B-1)", 1);
  assert.equal(fill("e_tender_submission_letter").ok, true);
  assert.equal(fields[0].value, "original");
});
