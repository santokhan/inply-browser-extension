import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { isTenderPreparationPage, openMyTenders, searchMyTender } from "./tenderMessaging.js";
import { openFirstFillLink, openTenderDashboard, openTenderPreparation, tenderPageAction } from "../content/tender.js";
import { detectFormType } from "../content/detectFormType.js";
import { ltmTenderForms } from "../data/ltmTenderForms.js";

afterEach(() => {
  for (const key of ["chrome", "window", "document"]) delete globalThis[key];
});

test("preparation checker requires the matching origin, pathname, tender ID, and tab 4", () => {
  const base = "https://www.eprocure.gov.bd/tenderer/LotTendPrep.jsp";
  assert.equal(isTenderPreparationPage(`${base}?tab=4&tenderId=1362999&msg=add`, "1362999"), true);
  assert.equal(isTenderPreparationPage(`${base}?tenderId=1362999&tab=4`, 1362999), true);
  assert.equal(isTenderPreparationPage(`${base}?tab=4&tenderId=1362999`, "001362999"), true);
  for (const url of [
    `${base}?tab=3&tenderId=1362999`,
    `${base}?tenderId=1362999`,
    `${base}?tab=4&tenderId=999`,
    `${base}?tab=4`,
    `${base.replace("LotTendPrep.jsp", "MyTenders.jsp")}?tab=4&tenderId=1362999`,
    `${base.replace("www.eprocure.gov.bd", "example.com")}?tab=4&tenderId=1362999`,
    "invalid", undefined,
  ]) assert.equal(isTenderPreparationPage(url, "1362999"), false, url);
});

test("matching preparation page skips My Tenders, search, dashboard, and preparation navigation", async () => {
  const steps = [];
  globalThis.chrome = {
    tabs: {
      get: async () => ({ status: "complete", url: "https://www.eprocure.gov.bd/tenderer/LotTendPrep.jsp?tab=4&tenderId=1362999&msg=add" }),
      sendMessage: async (tabId, message) => {
        assert.equal(message.action, "fillLtmForm");
        return { ok: true };
      },
    },
    scripting: { executeScript: async ({ func }) => {
      steps.push(func);
      return [{ result: func === detectFormType ? "activities_form" : { ok: true } }];
    } },
  };
  const actions = connectAutomation("1362999");
  assert.deepEqual(await openMyTenders(12, "1362999"), { ok: true });
  assert.equal((await searchMyTender(12, "1362999")).ok, true);
  assert.deepEqual(steps, [openFirstFillLink, detectFormType]);
  assert.deepEqual(actions, ["fill", "signAndVerify", "encrypt", "save"]);
});

test("another tender or another preparation tab still opens My Tenders", async () => {
  for (const query of ["tab=4&tenderId=999", "tab=3&tenderId=1362999"]) {
    const actions = [];
    globalThis.chrome = { tabs: {
      get: async () => ({ url: `https://www.eprocure.gov.bd/tenderer/LotTendPrep.jsp?${query}` }),
      sendMessage: async (tabId, message) => { actions.push(message.action); return { ok: true }; },
    } };
    await openMyTenders(12, "1362999");
    assert.deepEqual(actions, ["openTenders"]);
  }
});

function connectAutomation(tenderId = "1234") {
  const actions = [];
  let saved = false;
  const get = chrome.tabs.get;
  chrome.tabs.get = async (tabId) => {
    const tab = await get(tabId);
    return saved ? { ...tab, status: "complete", url: `https://www.eprocure.gov.bd/tenderer/LotTendPrep.jsp?tab=4&tenderId=${tenderId}` } : tab;
  };
  chrome.storage = { local: { get: async () => ({ encryptPassword: "test-password" }) } };
  const send = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (tabId, message) => {
    if (["signAndVerify", "save"].includes(message.action)) {
      actions.push(message.action);
      if (message.action === "save") saved = true;
      return { ok: true, verified: true };
    }
    if (message.action === "fillLtmForm") actions.push("fill");
    return send(tabId, message);
  };
  const execute = chrome.scripting.executeScript;
  chrome.scripting.executeScript = async (options) => {
    if (saved && options.func === openFirstFillLink) return [{ result: { ok: false, noFillLinks: true } }];
    if (options.world === "MAIN") {
      actions.push("encrypt");
      return [{ result: { ok: true } }];
    }
    return execute(options);
  };
  return actions;
}

for (const failSecondFill of [false, true]) {
  test(`save redirect continues to the next form without restarting navigation (second fill fails: ${failSecondFill})`, async () => {
    const prepUrl = "https://www.eprocure.gov.bd/tenderer/LotTendPrep.jsp?tab=4&tenderId=1362999";
    const navigation = [];
    const actions = [];
    let url = "https://www.eprocure.gov.bd/tenderer/MyTenders.jsp";
    let opened = 0;
    let loading = false;
    globalThis.chrome = {
      storage: { local: { get: async () => ({ encryptPassword: "test" }) } },
      tabs: {
        get: async () => {
          if (loading) { loading = false; return { status: "loading", url }; }
          return { status: "complete", url };
        },
        sendMessage: async (tabId, message) => {
          actions.push(message.action);
          if (message.action === "fillLtmForm" && opened === 2 && failSecondFill) {
            return { ok: false, message: "Second form fields do not match." };
          }
          if (message.action === "save") { url = prepUrl; loading = true; }
          return { ok: true, verified: true };
        },
      },
      scripting: { executeScript: async ({ func, world }) => {
        if (world === "MAIN") { actions.push("encrypt"); return [{ result: { ok: true } }]; }
        navigation.push(func);
        if (func === openTenderPreparation) url = prepUrl;
        if (func === openFirstFillLink) {
          if (opened === 2) return [{ result: { ok: false, noFillLinks: true } }];
          opened++;
          url = `https://www.eprocure.gov.bd/tenderer/BidFormLTM.jsp?form=${opened}&tenderId=1362999`;
          loading = true;
        }
        return [{ result: func === detectFormType ? "activities_form" : { ok: true } }];
      } },
    };
    const result = await searchMyTender(12, "1362999");
    assert.equal(result.ok, !failSecondFill);
    assert.equal(opened, 2);
    assert.deepEqual(navigation, [
      openTenderDashboard, openTenderPreparation, openFirstFillLink, detectFormType,
      openFirstFillLink, detectFormType, ...(!failSecondFill ? [openFirstFillLink] : []),
    ]);
    assert.deepEqual(actions, [
      "searchTender", "fillLtmForm", "signAndVerify", "encrypt", "save",
      "fillLtmForm", ...(!failSecondFill ? ["signAndVerify", "encrypt", "save"] : []),
    ]);
    if (failSecondFill) assert.equal(result.message, "Second form fields do not match.");
  });
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
  assert.equal(loads, 8);
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
