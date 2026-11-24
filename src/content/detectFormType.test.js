import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { detectFormType } from "./detectFormType.js";
import { ltmTenderForms } from "../data/ltmTenderForms.js";

afterEach(() => { delete globalThis.document; });

for (const title of ["Activity Form", "Activities Form", "  ACTIVITIES\n FORM  ", "Activities Form (Form e-PW2B-4)"]) {
  test(`detects ${JSON.stringify(title)} as activities_form when injected`, () => {
    globalThis.document = { querySelector: (selector) => {
      assert.equal(selector, "#divFormName");
      return { cloneNode: () => ({ textContent: title, querySelectorAll: () => [] }) };
    } };
    const injected = (0, eval)(`(${detectFormType.toString()})`);
    assert.equal(injected(ltmTenderForms.forms), "activities_form");
  });
}

test("unrelated headings remain unsupported", () => {
  globalThis.document = { querySelector: () => ({
    cloneNode: () => ({ textContent: "Activities Report", querySelectorAll: () => [] }),
  }) };
  assert.equal(detectFormType(ltmTenderForms.forms), null);
});

for (const suffix of ["01", "02", "03", "04"]) {
  test(`detects numbered BOQ heading :${suffix}`, () => {
    globalThis.document = { querySelector: () => ({
      cloneNode: () => ({
        textContent: `Priced Bill of Quantities (BOQ) :${suffix}`,
        querySelectorAll: () => [],
      }),
    }) };
    assert.equal(detectFormType(ltmTenderForms.forms), "priced_bill_of_quantities");
  });
}
