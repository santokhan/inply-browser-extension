import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { twMerge } from "tailwind-merge";
import { toast } from "react-toastify";

function openEncryptLinkInPage() {
  const anchor = [...document.querySelectorAll("a")].find((candidate) =>
    candidate instanceof HTMLAnchorElement && candidate.href && candidate.textContent.trim() === "Encrypt"
  );

  if (!anchor) {
    return { ok: false, message: "No Encrypt link was found on this page." };
  }

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

export default function OpenEncryptLink({ className = "" }) {
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
      const result = await openEncryptLink(tab.id);
      toast.info(result?.ok ? "Encrypt link opened." : (result?.message || "No Encrypt link was found."));
    } catch (error) {
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
    <button type="button" className={twMerge("hover-action grow", className)} onMouseEnter={handleOpenEncryptLink} disabled={opening}>
      {opening ? "Opening..." : "Open Encrypt"}
    </button>
  );
}