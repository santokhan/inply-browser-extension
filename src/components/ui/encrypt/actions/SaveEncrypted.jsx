import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";
import PageActionButton from "./PageActionButton";

import { sendSaveMessage } from "../../../../utils/pageActionMessaging.js";
export { sendSaveMessage } from "../../../../utils/pageActionMessaging.js";

export default function SaveEcrypted({ pageReady = false }) {
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
      if (!result?.ok) {
        toast.info(result?.message || "No Save button was found.");
      }
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
    <PageActionButton pageReady={pageReady} className="default grow" onClick={handleSave} disabled={saving}>
      {saving ? "Saving..." : "Save"}
    </PageActionButton>
  );
}
