import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { twMerge } from "tailwind-merge";
import { toast } from "react-toastify";
import PageActionButton from "./PageActionButton";

const PENDING_SIGN_ENCRYPT_SAVE_KEY = "pendingSignEncryptSave";

function openEncryptLinkInPage() {
  const anchor = [...document.querySelectorAll("a")].find((candidate) =>
    candidate instanceof HTMLAnchorElement && candidate.href && candidate.textContent.trim() === "Encrypt"
  );

  if (!anchor) {
    return { ok: false, message: "No Encrypt link was found on this page." };
  }

  anchor.target = "_self";
  anchor.click();
  return { ok: true };
}

async function openEncryptLink(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: openEncryptLinkInPage,
  });
  return result?.result;
}

export default function OpenEncryptLink({ className = "", pageReady = false }) {
  const [opening, setOpening] = useState(false);
  const hoverCooldown = useRef(false);

  async function handleOpenEncryptLink() {
    if (hoverCooldown.current) return;
    hoverCooldown.current = true;

    const tab = await getActiveTabSafe();
    if (!tab?.id) {
      toast.info("Open the tender preparation page before using Encrypt.");
      hoverCooldown.current = false;
      return;
    }

    try {
      setOpening(true);
      await chrome.storage.local.set({
        [PENDING_SIGN_ENCRYPT_SAVE_KEY]: { createdAt: Date.now() },
      });
      const result = await openEncryptLink(tab.id);
      if (!result?.ok) {
        await chrome.storage.local.remove(PENDING_SIGN_ENCRYPT_SAVE_KEY);
        toast.info(result?.message || "No Encrypt link was found on this page.");
      }
    } catch (error) {
      await chrome.storage.local.remove(PENDING_SIGN_ENCRYPT_SAVE_KEY).catch(() => {});
      console.error(error);
      toast.info("This page cannot be controlled by the extension.");
    } finally {
      setOpening(false);
      window.setTimeout(() => {
        hoverCooldown.current = false;
      }, 1500);
    }
  }

  return (
    <PageActionButton pageReady={pageReady} className={twMerge("default grow", className)} onClick={handleOpenEncryptLink} disabled={opening}>
      {opening ? "Opening..." : "Open Encrypt"}
    </PageActionButton>
  );
}
