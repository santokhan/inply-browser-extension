import { SITE_ORIGIN } from "../config/site.js";
import { normalizeTenderId } from "./tenderBasket.js";
import { openFirstFillLink, openTenderDashboard, openTenderPreparation, tenderPageAction } from "../content/tender.js";
import { detectFormType } from "../content/detectFormType.js";
import { ltmTenderForms } from "../data/ltmTenderForms.js";
import { sendLtmMessage } from "./ltmMessaging.js";
import { runFillSignEncryptSave } from "./fillSignEncryptSave.js";

async function sendTenderMessage(tabId, message) {
  const send = () => chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
  try {
    const result = await send();
    if (typeof result?.ok === "boolean"
      && !result.message?.includes("No content-script handler is registered for action")) return result;
  } catch (error) {
    if (!error.message?.includes("Receiving end does not exist")) throw error;
  }

  // Existing tabs may predate installation or an extension reload.
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: tenderPageAction,
    args: ["install"],
  });
  const deadline = Date.now() + 5000;
  do {
    try {
      const result = await send();
      if (typeof result?.ok === "boolean") return result;
    } catch (error) {
      if (!error.message?.includes("Receiving end does not exist")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error("Could not connect to My Tenders. Reload the eProcure tab and try again.");
}

export function isTenderPreparationPage(url, tenderId) {
  try {
    const page = new URL(url);
    return page.origin === SITE_ORIGIN
      && page.pathname === "/tenderer/LotTendPrep.jsp"
      && page.searchParams.get("tab") === "4"
      && normalizeTenderId(page.searchParams.get("tenderId")) === normalizeTenderId(tenderId);
  } catch {
    return false;
  }
}

export async function openMyTenders(tabId, tenderId) {
  if (tenderId != null && isTenderPreparationPage((await chrome.tabs.get(tabId)).url, tenderId)) {
    return { ok: true };
  }
  return sendTenderMessage(tabId, { action: "openTenders", expectedOrigin: SITE_ORIGIN });
}

async function fillDetectedTenderForm(tabId, formType, ltmForms) {
  const formKey = formType === "priced_boq" ? "priced_bill_of_quantities" : formType;
  const form = ltmForms[formKey];
  if (!form) return { ok: false, formType, message: "Could not identify a supported form to fill." };
  const filled = await runFillSignEncryptSave(tabId, {
    beforeRun: () => sendLtmMessage(tabId, { action: "fillLtmForm", formKey, form }),
  });
  if (!filled?.ok) {
    return { ...filled, ok: false, formType, message: filled?.message || `Could not fill ${form.name}.` };
  }
  return { ...filled, formType, message: `${form.name} filled, signed, encrypted, and saved.` };
}

async function continueAfterTenderSave(tabId, tenderId, ltmForms, detectionForms, lastResult) {
  while (true) {
    // Save submits the form. Wait for its redirect instead of restarting search.
    const deadline = Date.now() + 30000;
    while (true) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && new URL(tab.url).origin !== SITE_ORIGIN) {
        return { ok: false, message: "The tender page left eProcure." };
      }
      if (tab.status === "complete" && isTenderPreparationPage(tab.url, tenderId)) break;
      if (Date.now() >= deadline) {
        return { ok: false, message: "Save did not return to this tender's preparation tab (tab=4). Check the form for validation errors." };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const [opened] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] }, func: openFirstFillLink, args: [],
    });
    if (opened.result?.noFillLinks) return lastResult;
    if (!opened.result?.ok) return opened.result;

    const loadDeadline = Date.now() + 30000;
    await new Promise((resolve) => setTimeout(resolve, 200));
    while ((await chrome.tabs.get(tabId)).status === "loading") {
      if (Date.now() >= loadDeadline) return { ok: false, message: "The next tender form took too long to load." };
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const [detected] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] }, func: detectFormType, args: [detectionForms],
    });
    lastResult = await fillDetectedTenderForm(tabId, detected.result ?? null, ltmForms);
    if (!lastResult.ok) return lastResult;
  }
}

export async function searchMyTender(tabId, tenderId, ltmForms = ltmTenderForms.forms) {
  const message = { action: "searchTender", tenderId: normalizeTenderId(tenderId), expectedOrigin: SITE_ORIGIN };
  const deadline = Date.now() + 30000;
  do {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && new URL(tab.url).origin !== SITE_ORIGIN) {
      throw new Error("The tender page left eProcure.");
    }
    if (tab.status === "complete") {
      try {
        const alreadyPrepared = isTenderPreparationPage(tab.url, message.tenderId);
        const result = alreadyPrepared ? { ok: true } : await sendTenderMessage(tabId, message);
        if (!result?.retryable) {
          if (!result?.ok) return result;
          const { priced_bill_of_quantities, ...forms } = ltmForms;
          const detectionForms = { ...forms, priced_boq: priced_bill_of_quantities };
          const steps = alreadyPrepared
            ? [openFirstFillLink, detectFormType]
            : [openTenderDashboard, openTenderPreparation, openFirstFillLink, detectFormType];
          for (const nextStep of steps) {
            // Allow the preceding click to start navigation before checking load state.
            await new Promise((resolve) => setTimeout(resolve, 200));
            while ((await chrome.tabs.get(tabId)).status === "loading" && Date.now() < deadline) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
            if (Date.now() >= deadline) throw new Error("Tender page took too long to load.");
            const [execution] = await chrome.scripting.executeScript({
              target: { tabId, frameIds: [0] },
              func: nextStep,
              args: nextStep === detectFormType ? [detectionForms] : [],
            });
            if (nextStep === detectFormType) {
              const formType = execution.result ?? null;
              const filled = await fillDetectedTenderForm(tabId, formType, ltmForms);
              if (!filled.ok) return filled;
              // Return the promise directly so a later form error cannot replay
              // the search/navigation catch below after an earlier form saved.
              return continueAfterTenderSave(tabId, message.tenderId, ltmForms, detectionForms, filled);
            }
            if (nextStep === openFirstFillLink && execution.result?.noFillLinks
              && isTenderPreparationPage((await chrome.tabs.get(tabId)).url, message.tenderId)) {
              return { ok: true, message: `Tender ${message.tenderId} automation completed.` };
            }
            if (!execution.result?.ok) return execution.result;
          }
          return { ok: true };
        }
      } catch (error) {
        // My Tenders navigation may replace the document during a message.
        if (!/frame.*removed|document.*unloaded|message port closed|message channel closed/i.test(error.message)) throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  throw new Error("My Tenders took too long to load its search controls. Please try again.");
}
