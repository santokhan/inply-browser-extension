import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";

async function clickSaveInPage() {
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const button = [...document.querySelectorAll('#save, input[name="save"], button, input[type="submit"], input[type="button"], [role="button"]')].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
    return (element.id === "save" || element.name === "save" || label === "save")
      && !element.disabled
      && isVisible(element);
  });

  if (!button) {
    return { ok: false, count: 0, message: "No Save button was found on this page." };
  }

  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  return { ok: true, count: 1 };
}

export async function sendSaveMessage(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: "save" });
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) {
      throw error;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: clickSaveInPage,
    });
    return result?.result;
  }
}

export default function SaveEcrypted() {
  const [saving, setSaving] = useState(false);
  const hoverCooldown = useRef(false);

  async function handleSave() {
    if (hoverCooldown.current) return;

    const tab = await getActiveTabSafe();
    if (!tab?.id) {
      toast.info("Open the tender preparation page before using Save.");
      return;
    }

    hoverCooldown.current = true;
    try {
      setSaving(true);
      const result = await sendSaveMessage(tab.id);
      console.log("[Save] Response from page:", result);
      const count = Number.isFinite(result?.count) ? result.count : 0;
      toast.info(result?.ok
        ? ("Clicked " + count + " Save button.")
        : (result?.message || "No Save button was found."));
    } catch (error) {
      console.error(error);
      const errorMessage = String(error?.message || error);
      if (errorMessage.includes("Receiving end does not exist") || errorMessage.includes("Frame with ID 0 was removed")) {
        toast.info("Reload the target page, then try Save again.");
      } else {
        toast.info("This page cannot be controlled by the extension.");
      }
    } finally {
      setSaving(false);
      window.setTimeout(() => {
        hoverCooldown.current = false;
      }, 1500);
    }
  }

  return (
    <button type="button" className="hover-action grow" onMouseEnter={handleSave} disabled={saving}>
      {saving ? "Saving..." : "Save"}
    </button>
  );
}