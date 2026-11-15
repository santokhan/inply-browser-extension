import assert from "node:assert/strict";
import { test } from "node:test";
import { getCustomerLtmForms, ltmTenderForms, restoreLtmForms } from "./ltmTenderForms.js";

test("legacy activity_form saves load under activities_form", () => {
  const forms = restoreLtmForms({ activity_form: { values: { activity: { activity_duration_days: "65" } } } });
  assert.equal(forms.activities_form.values.activity.activity_duration_days, "65");
  assert.equal(forms.activities_form.name, "Activities Form");
  assert.equal(forms.activity_form, undefined);
});

test("activities_form saves take precedence over the old key", () => {
  const values = (days) => ({ values: { activity: { activity_duration_days: days } } });
  const forms = restoreLtmForms({ activity_form: values("65"), activities_form: values("75") });
  assert.equal(forms.activities_form.values.activity.activity_duration_days, "75");
});

test("automation restores saved presets and details for the selected customer", () => {
  const forms = getCustomerLtmForms({
    forms: { activities_form: { values: { activity: { activity_duration_days: "75" } } } },
    customerDetails: {
      customer1: { tenderers_legal_title: "Saved company", tenderers_registered_address: "Saved address" },
      customer2: { tenderers_legal_title: "Other company" },
    },
  }, { id: "customer1", businessName: "Default company", registeredAddress: "Default address" });
  assert.equal(forms.activities_form.values.activity.activity_duration_days, "75");
  assert.deepEqual(forms.tenderer_information.values.tenderer_details, {
    tenderers_legal_title: "Saved company", tenderers_registered_address: "Saved address",
  });
  assert.equal(ltmTenderForms.forms.tenderer_information.values.tenderer_details.tenderers_legal_title, "");
});

test("empty older customer overrides fall back to customer profile values", () => {
  const forms = getCustomerLtmForms({ customerDetails: {
    "test@example.com": { tenderers_legal_title: "  ", tenderers_registered_address: "" },
  } }, { email: "test@example.com", businessName: "Company", registeredAddress: "Address" });
  assert.deepEqual(forms.tenderer_information.values.tenderer_details, {
    tenderers_legal_title: "Company", tenderers_registered_address: "Address",
  });
});
