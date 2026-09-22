import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";

async function clickEncryptAndSaveInPage() {
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const button = [...document.querySelectorAll(
    '#encrypt, input[name="encrypt"], button, input[type="button"], input[type="submit"], [role="button"]'
  )].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return (label === "encrypt and save" || label === "encrypt") && !element.disabled && isVisible(element);
  });

  if (!button) {
    return { ok: false, count: 0, message: "No Encrypt And Save button was found on this page." };
  }

  await chrome.storage.local.set({
    pendingEncryptAndSave: { createdAt: Date.now() },
  });
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const okButton = [...document.querySelectorAll("#myPanelDiv button, #myPanelDiv input[type=\"button\"], #myPanelDiv input[type=\"submit\"]")].find((element) => {
      const label = (element.innerText || element.value || "").trim().toLowerCase();
      return label === "ok" && !element.disabled && isVisible(element);
    });
    if (okButton) {
      okButton.click();
      return { ok: true, count: 1, confirmed: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { ok: true, count: 1, confirmed: false };
}

export async function sendEncryptAndSaveMessage(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: "encryptAndSave" });
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) {
      throw error;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: clickEncryptAndSaveInPage,
    });
    return result?.result;
  }
}
export default function EncryptConfirmOk({ buttonLabel = "Encrypt & Save" }) {
  const [encrypting, setEncrypting] = useState(false);
  const hoverCooldown = useRef(false);

  return (
    <button type="button" className="default grow" onClick={async () => {
      if (hoverCooldown.current) return;
      const tab = await getActiveTabSafe();
      if (!tab?.id) {
        toast.info("Open the tender preparation page before using Encrypt.");
        return;
      }
      hoverCooldown.current = true;
      try {
        setEncrypting(true);
        const result = await sendEncryptAndSaveMessage(tab.id);
        console.log("[Encrypt And Save] Response from page:", result);
        const count = Number.isFinite(result?.count) ? result.count : 0;
        toast.info(result?.ok ? ("Clicked " + count + " Encrypt And Save button.") : (result?.message || "No Encrypt And Save button was found."));
      } catch (error) {
        console.error(error);
        const errorMessage = String(error?.message || error);
        if (errorMessage.includes("Receiving end does not exist") || errorMessage.includes("Frame with ID 0 was removed")) {
          toast.info("Reload the target page, then try Encrypt again.");
        } else {
          console.error(error);
          toast.info("This page cannot be controlled by the extension.");
        }
      } finally {
        setEncrypting(false);

        window.setTimeout(() => {
          hoverCooldown.current = false;
        }, 1500);
      }
    }}
      disabled={encrypting}
    >
      {encrypting ? "Encrypting..." : buttonLabel}
    </button>
  );
}
