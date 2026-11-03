import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { sendSignAndVerifyMessage } from "./Sign";
import { sendSaveMessage } from "./SaveEncrypted";
import { toast } from "react-toastify";
import PageActionButton from "./PageActionButton";
import { sendEncryptMessage } from "./Encrypt";

const ACTIONS = ["signAndVerify", "onlyEncrypt", "save"];
const ENCRYPT_PASSWORD_KEY = "encryptPassword";
const STEP_DELAY_MS = 1000;
const ENCRYPT_TO_SAVE_DELAY_MS = 1000;
const ACTION_LABELS = {
  signAndVerify: "Sign",
  onlyEncrypt: "Encrypt",
  save: "Save",
};

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitWithCountdown(milliseconds, nextAction, setStatus) {
  const endTime = Date.now() + milliseconds;
  while (Date.now() < endTime) {
    const secondsLeft = Math.ceil((endTime - Date.now()) / 1000);
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

export default function SignEncryptSave({ pageReady = true }) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const hoverCooldown = useRef(false);

  async function handleRunAll() {
    if (hoverCooldown.current) return;

    const tab = await getActiveTabSafe();
    if (!tab?.id) {
      toast.info("Open the tender preparation page before using Sign, Encrypt & Save.");
      return;
    }

    const saved = await chrome.storage.local.get(ENCRYPT_PASSWORD_KEY);
    if (!saved?.[ENCRYPT_PASSWORD_KEY]) {
      toast.info("Enter and save a password before using Sign, Encrypt & Save.");
      return;
    }

    hoverCooldown.current = true;
    try {
      setRunning(true);
      for (let index = 0; index < ACTIONS.length; index += 1) {
        const action = ACTIONS[index];
        setStatus(`${ACTION_LABELS[action]}…`);
        const result = await sendActionWithRetry(tab.id, action, saved[ENCRYPT_PASSWORD_KEY]);
        const verificationFailed = action === "signAndVerify" && !result?.verified;
        if (!result?.ok || verificationFailed) {
          toast.info(result?.message || `Could not complete ${action}.`);
          return;
        }
        if (index < ACTIONS.length - 1) {
          const delay = action === "onlyEncrypt" ? ENCRYPT_TO_SAVE_DELAY_MS : STEP_DELAY_MS;
          await waitWithCountdown(delay, ACTION_LABELS[ACTIONS[index + 1]], setStatus);
        }
      }
    } catch (error) {
      console.error(error);
      toast.info("This page cannot be controlled by the extension. Reload the page and try again.");
    } finally {
      setRunning(false);
      setStatus("");
      window.setTimeout(() => {
        hoverCooldown.current = false;
      }, 1500);
    }
  }

  return (
    <PageActionButton pageReady={pageReady} className="default w-full" onClick={handleRunAll} disabled={running}>
      {/* Total 3 actions */}
      {running ? status || "Running..." : pageReady ? "Sign Encrypt Save" : "Waiting for page..."}
    </PageActionButton>
  );
}
