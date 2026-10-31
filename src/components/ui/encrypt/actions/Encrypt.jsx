import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";
import PageActionButton from "./PageActionButton";

async function encryptInPage() {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const getButton = () => [...document.querySelectorAll('input#encrypt, input[name="encrypt"], input[type="button"]')]
    .find((element) => !element.disabled && isVisible(element));

  const deadline = Date.now() + 10000;
  let button;
  while (!(button = getButton()) && Date.now() < deadline) await wait(250);
  if (!button) return { ok: false, verified: false, message: "No enabled Encrypt button appeared within 10 seconds." };
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  return { ok: true, count: 1 };
}

export async function sendEncryptMessage(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: "onlyEncrypt" });
    if (!response?.message?.includes('No content-script handler is registered for action "onlyEncrypt"')) {
      return response;
    }
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) {
      throw error;
    }
  }

  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: encryptInPage });
  return result?.result;
}

export default function EncryptSignedLetter({ buttonLabel = "Encrypt & Save", pageReady = false }) {
  const [encrypting, setEncrypting] = useState(false);
  const hoverCooldown = useRef(false);

  return (
    <PageActionButton type="button" pageReady={pageReady} className="default grow" onClick={async () => {
      if (hoverCooldown.current) return;
      const tab = await getActiveTabSafe();
      if (!tab?.id) {
        toast.info("Open the tender preparation page before using Encrypt.");
        return;
      }
      hoverCooldown.current = true;
      try {
        setEncrypting(true);
        const result = await sendEncryptMessage(tab.id);
        console.log("[Encrypt] Response from page:", result);
        if (!result?.ok) {
          toast.info(result?.message || "No Encrypt And Save button was found.");
        }
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
    </PageActionButton>
  );
}
