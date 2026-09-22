import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";

async function decryptAndEncryptInPage() {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const labelOf = (element) => (element.innerText || element.value || element.getAttribute("aria-label") || "")
    .replace(/\s+/g, " ").trim().toLowerCase();
  const decryptButton = [...document.querySelectorAll("#decrypt, button, input[type=\"button\"], input[type=\"submit\"], [role=\"button\"]")]
    .find((element) => labelOf(element) === "decrypt" && !element.disabled && isVisible(element));

  if (!decryptButton) return { ok: false, message: "No Decrypt button was found on this page." };
  decryptButton.scrollIntoView({ block: "center", behavior: "smooth" });
  decryptButton.click();
  const password = (await chrome.storage.local.get("encryptPassword"))?.encryptPassword;
  if (!password) return { ok: false, message: "Enter and save a password before using Decrypt & Encrypt." };

  let verified = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const input = document.querySelector("#myPanelDiv input#password, #myPanelDiv input[name=\"password\"]");
    if (input && isVisible(input)) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, password); else input.value = password;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const verifyButton = [...document.querySelectorAll("#myPanelDiv button, #myPanelDiv input[type=\"button\"], #myPanelDiv input[type=\"submit\"]")]
        .find((element) => labelOf(element) === "verify password" && !element.disabled && isVisible(element));
      if (verifyButton) {
        verifyButton.click();
        verified = true;
        break;
      }
    }
    await wait(250);
  }
  if (!verified) return { ok: false, message: "The password dialog was not ready." };
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const encryptButton = [...document.querySelectorAll("#encrypt, input[name=\"encrypt\"], button, input[type=\"button\"], input[type=\"submit\"], [role=\"button\"]")].find((element) => ["encrypt and save", "encrypt"].includes(labelOf(element)) && !element.disabled && isVisible(element));
    if (encryptButton) {
      encryptButton.scrollIntoView({ block: "center", behavior: "smooth" });
      encryptButton.click();
      for (let confirmationAttempt = 0; confirmationAttempt < 40; confirmationAttempt += 1) {
        const okButton = [...document.querySelectorAll("#myPanelDiv button, #myPanelDiv input[type=\"button\"], #myPanelDiv input[type=\"submit\"]")].find((element) => labelOf(element) === "ok" && !element.disabled && isVisible(element));
        if (okButton) {
          okButton.click();
          return { ok: true, count: 1, confirmed: true };
        }
        await wait(250);
      }
      return { ok: true, count: 1, confirmed: false };
    }
    await wait(250);
  }
  return { ok: false, message: "The Encrypt & Save button was not ready." };
}

async function sendDecryptAndEncryptMessage(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: decryptAndEncryptInPage,
  });
  return result?.result;
}

export default function DecryptEncryptSave({ pageReady = true }) {
  const notify = (message) => {

  };
  const [running, setRunning] = useState(false);
  const cooldown = useRef(false);

  async function handleAction() {
    if (cooldown.current) return;
    const tab = await getActiveTabSafe();
    if (!tab?.id) {
      toast.info("Open the tender preparation page before using Decrypt & Encrypt.");
      return;
    }
    cooldown.current = true;
    try {
      setRunning(true);
      const result = await sendDecryptAndEncryptMessage(tab.id);
      toast.info(result?.ok
        ? "Decrypt, Encrypt & Save completed."
        : (result?.message || "Could not start Decrypt & Encrypt."));
    } catch (error) {
      console.error(error);
      const errorMessage = String(error?.message || error);
      toast.error(errorMessage.includes("Receiving end does not exist") || errorMessage.includes("Frame with ID 0 was removed")
        ? "Reload the target page, then try Decrypt & Encrypt again."
        : "This page cannot be controlled by the extension.");
    } finally {
      setRunning(false);
      window.setTimeout(() => { cooldown.current = false; }, 1500);
    }
  }

  return (
    <button type="button" className="default w-full" onClick={handleAction} disabled={running || !pageReady}>
      {/* Total 2 actions */}
      {running ? "Decrypting and saving..." : pageReady ? "Decrypt + Encrypt & Save" : "Waiting for page..."}
    </button>
  );
}
