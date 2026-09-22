import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { twMerge } from "tailwind-merge";
import { toast } from "react-toastify";

async function openEncryptLink(tabId) {
  return chrome.runtime.sendMessage({
    action: "duplicateAndClickEncryptLinks",
    tabId,
  });
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
      if (!result?.ok) {
        toast.info(result?.message || "No Encrypt links were found on this page.");
      }
    } catch (error) {
      console.error(error);
      toast.info(`Open Encrypt failed: ${error?.message || "unknown extension error"}`);
    } finally {
      setOpening(false);
      window.setTimeout(() => {
        hoverCooldown.current = false;
      }, 1500);
    }
  }

  return (
    <button type="button" className={twMerge("default grow", className)} onClick={handleOpenEncryptLink} disabled={opening}>
      {opening ? "Opening..." : "Open Encrypt"}
    </button>
  );
}
