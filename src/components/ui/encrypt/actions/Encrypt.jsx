import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";
import PageActionButton from "./PageActionButton";

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
