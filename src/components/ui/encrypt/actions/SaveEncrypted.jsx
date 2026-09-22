import { useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";

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

async function sendSaveMessage(tabId) {
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

export default function SaveEcrypted({ setMessage = () => {} }) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const tab = await getActiveTabSafe();
    if (!tab?.id) {
      setMessage("Open the tender preparation page before using Save.");
      return;
    }

    try {
      setSaving(true);
      const result = await sendSaveMessage(tab.id);
      console.log("[Save] Response from page:", result);
      const count = Number.isFinite(result?.count) ? result.count : 0;
      setMessage(result?.ok
        ? ("Clicked " + count + " Save button.")
        : (result?.message || "No Save button was found."));
    } catch (error) {
      console.error(error);
      const errorMessage = String(error?.message || error);
      if (errorMessage.includes("Receiving end does not exist") || errorMessage.includes("Frame with ID 0 was removed")) {
        setMessage("Reload the target page, then try Save again.");
      } else {
        setMessage("This page cannot be controlled by the extension.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <button type="button" className="default" onClick={handleSave} disabled={saving}>
      {saving ? "Saving..." : "Save"}
    </button>
  );
}