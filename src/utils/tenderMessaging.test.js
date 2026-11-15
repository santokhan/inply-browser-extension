import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { openMyTenders, searchMyTender } from "./tenderMessaging.js";
import { openFirstFillLink, openTenderDashboard, openTenderPreparation, tenderPageAction } from "../content/tender.js";
import { detectFormType } from "../content/detectFormType.js";
import { ltmTenderForms } from "../data/ltmTenderForms.js";

afterEach(() => {
  for (const key of ["chrome", "window", "document"]) delete globalThis[key];
});

function connectAutomation() {
  const actions = [];
  chrome.storage = { local: { get: async () => ({ encryptPassword: "test-password" }) } };
  const send = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (tabId, message) => {
    if (["signAndVerify", "save"].includes(message.action)) {
      actions.push(message.action);
      return { ok: true, verified: true };
    }
    if (message.action === "fillLtmForm") actions.push("fill");
    return send(tabId, message);
  };
  const execute = chrome.scripting.executeScript;
  chrome.scripting.executeScript = async (options) => {
    if (options.world === "MAIN") {
      actions.push("encrypt");
      return [{ result: { ok: true } }];
    }
    return execute(options);
  };
  return actions;
}

for (const formType of [...Object.keys(ltmTenderForms.forms), null, "unsupported_form"]) {
  test(`detected key ${formType} selects only its matching preset`, async () => {
    const fills = [];
    const savedForms = structuredClone(ltmTenderForms.forms);
    savedForms.activities_form.values.activity.activity_duration_days = "75";
    globalThis.chrome = {
      tabs: {
        get: async () => ({ status: "complete" }),
        sendMessage: async (tabId, message) => {
          if (message.action === "fillLtmForm") fills.push(message);
          return { ok: true, count: 2 };
        },
      },
      scripting: { executeScript: async ({ func }) => [
        { result: func === detectFormType ? formType : { ok: true } },
      ] },
    };
    const actions = connectAutomation();
    const result = await searchMyTender(12, "1234", savedForms);
    const form = savedForms[formType];
    assert.equal(result.ok, Boolean(form));
    assert.deepEqual(actions, form ? ["fill", "signAndVerify", "encrypt", "save"] : []);
    assert.equal(result.formType, formType);
    assert.deepEqual(fills, form ? [{ action: "fillLtmForm", formKey: formType, form }] : []);
  });
}

test("filling errors are returned to the tender basket", async () => {
  globalThis.chrome = {
    tabs: {
      get: async () => ({ status: "complete" }),
      sendMessage: async (tabId, message) => message.action === "fillLtmForm"
        ? { ok: false, message: "The webpage fields do not match." } : { ok: true },
    },
    scripting: { executeScript: async ({ func }) => [
      { result: func === detectFormType ? "activities_form" : { ok: true } },
    ] },
  };
  connectAutomation();
  assert.deepEqual(await searchMyTender(12, "1234"), {
    ok: false, formType: "activities_form", message: "The webpage fields do not match.",
  });
});

test("opening My Tenders installs its receiver when an existing tab has none", async () => {
  let sends = 0;
  const injections = [];
  globalThis.chrome = {
    tabs: { sendMessage: async () => {
      if (++sends === 1) throw new Error("Could not establish connection. Receiving end does not exist.");
      return { ok: true };
    } },
    scripting: { executeScript: async (options) => { injections.push(options); } },
  };
  assert.deepEqual(await openMyTenders(12), { ok: true });
  assert.equal(sends, 2);
  assert.deepEqual(injections, [{ target: { tabId: 12, frameIds: [0] }, func: tenderPageAction, args: ["install"] }]);
});

test("the injected receiver runs without module scope and installs once", () => {
  const install = (0, eval)(`(${tenderPageAction.toString()})`);
  const listeners = [];
  let clicks = 0;
  globalThis.window = { location: { origin: "https://www.eprocure.gov.bd" } };
  globalThis.document = { querySelector: () => ({ click: () => { clicks++; } }) };
  globalThis.chrome = { runtime: { onMessage: { addListener: (listener) => listeners.push(listener) } } };
  install("install");
  install("install");
  assert.equal(listeners.length, 1);
  let result;
  listeners[0]({ action: "openTenders", expectedOrigin: window.location.origin }, {}, (reply) => { result = reply; });
  assert.equal(result.ok, true);
  assert.equal(clicks, 1);
});

test("a reply reporting a missing link is returned without installing or clicking again", async () => {
  const result = { ok: false, message: "My Tenders link not found on this page." };
  globalThis.chrome = {
    tabs: { sendMessage: async () => result },
    scripting: { executeScript: async () => assert.fail("A connected tab needs no injection") },
  };
  assert.equal(await openMyTenders(12), result);
});

test("search waits for navigation and controls, then sends the selected tender ID", async () => {
  let loads = 0;
  const messages = [];
  const steps = [];
  globalThis.chrome = {
    tabs: {
      get: async () => ({ status: ++loads === 1 ? "loading" : "complete" }),
      sendMessage: async (tabId, message) => {
        assert.equal(tabId, 12);
        messages.push(message);
        if (messages.length === 1) return { ok: false, retryable: true };
        return { ok: true, message: "Search started." };
      },
    },
    scripting: { executeScript: async ({ func }) => {
      steps.push(func);
      return [{ result: func === detectFormType ? "activities_form" : { ok: true } }];
    } },
  };
  connectAutomation();
  assert.equal((await searchMyTender(12, "001234")).ok, true);
  assert.equal(loads, 7);
  assert.equal(messages.length, 3);
  assert.equal(messages[1].action, "searchTender");
  assert.equal(messages[1].tenderId, "1234");
  assert.deepEqual(messages[2], {
    action: "fillLtmForm", formKey: "activities_form", form: ltmTenderForms.forms.activities_form,
  });
  assert.deepEqual(steps, [openTenderDashboard, openTenderPreparation, openFirstFillLink, detectFormType]);
});

test("search opens dashboard, preparation and Fill in order after navigation", async () => {
  const clicked = [];
  globalThis.document = {
    querySelector: (selector) => {
      if (selector === "#divFormName") {
        assert.equal(clicked.length, 3);
        return { cloneNode: () => ({
          textContent: "Priced Bill of Quantities (BOQ)",
          querySelectorAll: () => [],
        }) };
      }
      return { click: () => { clicked.push(selector); } };
    },
    querySelectorAll: (selector) => [
      { innerText: "View", click: () => assert.fail("Only Fill links should be clicked") },
      { innerText: " Fill ", click: () => { clicked.push(selector); } },
    ],
  };
  globalThis.chrome = {
    tabs: {
      get: async () => ({ status: "complete" }),
      sendMessage: async (tabId, message) => {
        if (message.action === "fillLtmForm") {
          assert.equal(message.formKey, "priced_bill_of_quantities");
          assert.deepEqual(message.form, ltmTenderForms.forms.priced_bill_of_quantities);
          return { ok: true, count: 3 };
        }
        assert.equal(message.action, "searchTender");
        return { ok: true };
      },
    },
    scripting: { executeScript: async ({ func, target, args }) => {
      assert.equal(func, [openTenderDashboard, openTenderPreparation, openFirstFillLink, detectFormType][clicked.length]);
      assert.deepEqual(target, { tabId: 12, frameIds: [0] });
      const execute = (0, eval)(`(${func.toString()})`);
      return [{ result: execute(...args) }];
    } },
  };
  connectAutomation();
  assert.deepEqual(await searchMyTender(12, "1234"), {
    ok: true,
    formType: "priced_boq",
    message: "Priced Bill of Quantities (BOQ) filled, signed, encrypted, and saved.",
  });
  assert.deepEqual(clicked, ['table tbody tr td a[title="Dashboard"]', '#hrfTendPrep', 'table tbody tr td a[href^="BidFormLTM.jsp"]']);
});
