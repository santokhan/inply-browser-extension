import { sendSignAndVerifyMessage, sendEncryptMessage, sendSaveMessage } from "./pageActionMessaging.js";

const ACTIONS = ["signAndVerify", "onlyEncrypt", "save"];
const ENCRYPT_PASSWORD_KEY = "encryptPassword";
const STEP_DELAY_MS = 500;
const ENCRYPT_TO_SAVE_DELAY_MS = 500;
const ACTION_LABELS = {
  signAndVerify: "Sign",
  onlyEncrypt: "Encrypt",
  save: "Save",
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitWithCountdown(milliseconds, nextAction, setStatus) {
  const endTime = Date.now() + milliseconds;
  while (Date.now() < endTime) {
    const secondsLeft = Math.ceil((endTime - Date.now()) / 500);
    setStatus(`Starting ${nextAction} in ${secondsLeft}…`);
    await wait(Math.min(200, endTime - Date.now()));
  }
}

async function sendActionWithRetry(tabId, action, password) {
  if (action === "onlyEncrypt") {
    return sendEncryptMessage(tabId);
  }

  let lastResult;

  // Signing can update or re-render the page before the Encrypt control is
  // available. Give the page a short window to settle before failing.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      lastResult = await chrome.tabs.sendMessage(tabId, { action });
      if (lastResult?.message?.includes(`No content-script handler is registered for action "${action}"`)) {
        if (action === "signAndVerify") lastResult = await sendSignAndVerifyMessage(tabId, password);
        else lastResult = await sendSaveMessage(tabId);
      }
    } catch (error) {
      if (!String(error?.message || error).includes("Receiving end does not exist")) throw error;
      if (action === "signAndVerify") lastResult = await sendSignAndVerifyMessage(tabId, password);
      else lastResult = await sendSaveMessage(tabId);
    }
    if (lastResult?.ok || attempt === 11) return lastResult;
    await wait(250);
  }

  return lastResult;
}

export async function runFillSignEncryptSave(tabId, { beforeRun, beforeActions, applyOnly = false, setStatus = () => {} } = {}) {
  const saved = applyOnly ? {} : await chrome.storage.local.get(ENCRYPT_PASSWORD_KEY);
  if (!applyOnly && !saved?.[ENCRYPT_PASSWORD_KEY]) {
    return { ok: false, message: "Enter and save a password before using Sign, Encrypt & Save." };
  }
  if (beforeRun) {
    setStatus("Filling...");
    const result = await beforeRun(tabId);
    if (!result?.ok) return { ...result, ok: false, message: result?.message || "Could not fill this form." };
  }
  if (applyOnly) return { ok: true };
  if (beforeActions) {
    setStatus("Checking credits...");
    try {
      await beforeActions();
    } catch (error) {
      return { ok: false, stage: "billing", message: error.message || "Could not charge credits. Try again." };
    }
  }
  for (let index = 0; index < ACTIONS.length; index += 1) {
    const action = ACTIONS[index];
    setStatus(`${ACTION_LABELS[action]}...`);
    let result;
    try {
      result = await sendActionWithRetry(tabId, action, saved[ENCRYPT_PASSWORD_KEY]);
    } catch (error) {
      return { ok: false, stage: action, message: `${ACTION_LABELS[action]} failed: ${error.message || error}` };
    }
    if (!result?.ok || (action === "signAndVerify" && !result?.verified)) {
      return { ...result, ok: false, stage: action, message: result?.message
        ? `${ACTION_LABELS[action]} failed: ${result.message}`
        : action === "signAndVerify" && result?.ok
          ? "Sign failed: password verification did not start."
          : `Could not complete ${ACTION_LABELS[action]}.` };
    }
    if (index < ACTIONS.length - 1) {
      const delay = action === "onlyEncrypt" ? ENCRYPT_TO_SAVE_DELAY_MS : STEP_DELAY_MS;
      await waitWithCountdown(delay, ACTION_LABELS[ACTIONS[index + 1]], setStatus);
    }
  }
  return { ok: true };
}
