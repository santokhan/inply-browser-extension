import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";
import PageActionButton from "./PageActionButton";

async function decryptInPage() {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    for (let current = element; current; current = current.parentElement) {
      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return element.isConnected;
  };
  const labelOf = (element) => (element.innerText || element.value || element.getAttribute("aria-label") || "")
    .replace(/\s+/g, " ").trim().toLowerCase();
  const decryptButton = [...document.querySelectorAll("#decrypt, button, input[type=\"button\"], input[type=\"submit\"], [role=\"button\"]")]
    .find((element) => labelOf(element) === "decrypt" && !element.disabled && isVisible(element));

  if (!decryptButton) return {
    ok: false,
    message: "No Decrypt button was found on this page."
  };
  const password = (await chrome.storage.local.get("encryptPassword"))?.encryptPassword;
  if (!password) return {
    ok: false,
    message: "Enter and save a password before testing Decrypt."
  };
  decryptButton.scrollIntoView({ block: "center", behavior: "smooth" });
  decryptButton.click();

  let passwordInput;
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
        passwordInput = input;
        verifyButton.click();
        break;
      }
    }
    await wait(250);
  }
  if (!passwordInput) return {
    ok: false,
    message: "The password dialog was not ready."
  };
  // Verification starts asynchronous page work. The Encrypt button may already
  // be enabled while decrypted fields are still being populated.
  let lastChange = Date.now();
  const startedAt = Date.now();
  const observer = new MutationObserver(() => { lastChange = Date.now(); });
  observer.observe(document.getElementById("frmBidSubmit") || document.body, {
    subtree: true, childList: true, attributes: true, characterData: true,
  });
  const onFieldChange = () => { lastChange = Date.now(); };
  document.addEventListener("input", onFieldChange, true);
  document.addEventListener("change", onFieldChange, true);
  try {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const encryptButton = [...document.querySelectorAll('#encrypt, input[name="encrypt"], button, input[type="button"], input[type="submit"], [role="button"]')]
        .find((element) => ["encrypt and save", "encrypt"].includes(labelOf(element)) && !element.disabled && isVisible(element));
      if (!isVisible(passwordInput) && encryptButton && Date.now() - startedAt >= 2000 && Date.now() - lastChange >= 1500) {
        return { ok: true, message: "Decrypt password dialog closed and the form is ready for encryption." };
      }
      await wait(250);
    }
    return { ok: false, message: "Decryption did not finish within 30 seconds. Check the page and password before retrying." };
  } finally {
    observer.disconnect();
    document.removeEventListener("input", onFieldChange, true);
    document.removeEventListener("change", onFieldChange, true);
  }
}

async function encryptAndSaveInPage() {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const labelOf = (element) => (element.innerText || element.value || element.getAttribute("aria-label") || "")
    .replace(/\s+/g, " ").trim().toLowerCase();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const encryptButton = [...document.querySelectorAll("#encrypt, input[name=\"encrypt\"], button, input[type=\"button\"], input[type=\"submit\"], [role=\"button\"]")].find((element) => ["encrypt and save", "encrypt"].includes(labelOf(element)) && !element.disabled && isVisible(element));
    if (encryptButton) {
      encryptButton.scrollIntoView({ block: "center", behavior: "smooth" });
      encryptButton.click();
      for (let confirmationAttempt = 0; confirmationAttempt < 40; confirmationAttempt += 1) {
        const okButton = [...document.querySelectorAll("#myPanelDiv button, #myPanelDiv input[type=\"button\"], #myPanelDiv input[type=\"submit\"]")].find((element) => labelOf(element) === "ok" && !element.disabled && isVisible(element));
        if (okButton) {
          okButton.click();
          return { ok: true, count: 1, confirmed: true, message: "Encrypt & Save confirmation clicked. Check the page for the result." };
        }
        await wait(250);
      }
      return { ok: false, count: 1, confirmed: false, message: "Encrypt & Save clicked, but its confirmation was not found. Check the page." };
    }
    await wait(250);
  }
  return {
    ok: false,
    message: "The Encrypt & Save button was not ready."
  };
}

async function sendTestAction(tabId, action) {
  if (action === "combined") {
    const decrypted = await sendTestAction(tabId, "decrypt");
    if (!decrypted?.ok) return decrypted;
    return sendTestAction(tabId, "encryptAndSave");
  }
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: action === "decrypt" ? decryptInPage : encryptAndSaveInPage,
  });
  return result?.result;
}

export default function DecryptEncryptSave({ pageReady = true }) {
  const [running, setRunning] = useState(null);
  const cooldown = useRef(false);

  async function handleAction(action) {
    if (!pageReady || cooldown.current) return;
    cooldown.current = true;
    const label = action === "combined" ? "Decrypt + Encrypt & Save" : action === "decrypt" ? "Decrypt" : "Encrypt & Save";
    try {
      const tab = await getActiveTabSafe();
      if (!tab?.id) {
        toast.info(`Open the tender preparation page before testing ${label}.`);
        return;
      }
      setRunning(action);
      const result = await sendTestAction(tab.id, action);
      if (!result?.ok) {
        toast.info(result?.message || `Could not run ${label}.`);
      } else {
        toast.info(result.message);
      }
    } catch (error) {
      console.error(error);
      const errorMessage = String(error?.message || error);
      toast.error(errorMessage.includes("Receiving end does not exist") || errorMessage.includes("Frame with ID 0 was removed")
        ? `The page changed during ${label}. Check its result before retrying.`
        : "This page cannot be controlled by the extension.");
    } finally {
      setRunning(null);
      window.setTimeout(() => { cooldown.current = false; }, 1500);
    }
  }

  return (
    <div className="space-y-2">
      <PageActionButton
        pageReady={pageReady}
        className="default w-full"
        onClick={() => handleAction("combined")}
        disabled={running !== null}
      >
        {running === "combined" ? "Decrypting, then encrypting and saving..." : "Decrypt + Encrypt & Save"}
      </PageActionButton>
      <div className="flex gap-2">
      <PageActionButton
        pageReady={pageReady}
        className="default w-full"
        onClick={() => handleAction("decrypt")}
        disabled={running !== null}
      >
        {running === "decrypt" ? "Decrypting..." : "Test Decrypt"}
      </PageActionButton>
      <PageActionButton
        pageReady={pageReady}
        className="default w-full"
        onClick={() => handleAction("encryptAndSave")}
        disabled={running !== null}
      >
        {running === "encryptAndSave" ? "Encrypting and saving..." : "Test Encrypt & Save"}
      </PageActionButton>
      </div>
    </div>
  );
}
