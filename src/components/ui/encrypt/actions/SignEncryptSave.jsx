import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { sendSignMessage } from "./Sign";
import { sendEncryptAndSaveMessage } from "./Encrypt";
import { sendSaveMessage } from "./SaveEncrypted";
import { toast } from "react-toastify";

const ACTIONS = ["signAndVerify", "encryptAndSave", "save"];
const ENCRYPT_PASSWORD_KEY = "encryptPassword";

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function sendActionWithRetry(tabId, action, password) {
  let lastResult;

  // Signing can update or re-render the page before the Encrypt control is
  // available. Give the page a short window to settle before failing.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      lastResult = await chrome.tabs.sendMessage(tabId, { action });
    } catch (error) {
      if (!String(error?.message || error).includes("Receiving end does not exist")) throw error;
      if (action === "signAndVerify") lastResult = await sendSignMessage(tabId, password);
      else if (action === "encryptAndSave") lastResult = await sendEncryptAndSaveMessage(tabId);
      else lastResult = await sendSaveMessage(tabId);
    }
    if (lastResult?.ok || attempt === 11) return lastResult;
    await wait(250);
  }

  return lastResult;
}

export default function SignEncryptSave() {
  const [running, setRunning] = useState(false);
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
      for (const action of ACTIONS) {
        const result = await sendActionWithRetry(tab.id, action, saved[ENCRYPT_PASSWORD_KEY]);
        const verificationFailed = action === "signAndVerify" && !result?.verified;
        const encryptionNotConfirmed = action === "encryptAndSave" && !result?.confirmed;
        if (!result?.ok || verificationFailed || encryptionNotConfirmed) {
          toast.info(result?.message || `Could not complete ${action}.`);
          return;
        }
        if (action !== "save") await wait(500);
      }
      toast.info("Sign, Encrypt & Save completed.");
    } catch (error) {
      console.error(error);
      toast.info("This page cannot be controlled by the extension. Reload the page and try again.");
    } finally {
      setRunning(false);
      window.setTimeout(() => {
        hoverCooldown.current = false;
      }, 1500);
    }
  }

  return (
    <button type="button" className="default w-full" onClick={handleRunAll} disabled={running}>
      {/* Total 3 actions */}
      {running ? "Running..." : "Sign + Encrypt + Save"}
    </button>
  );
}
