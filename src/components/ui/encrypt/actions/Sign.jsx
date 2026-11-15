import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";
import PageActionButton from "./PageActionButton";

import { sendSignAndVerifyMessage } from "../../../../utils/pageActionMessaging.js";
export { sendSignAndVerifyMessage } from "../../../../utils/pageActionMessaging.js";

const ENCRYPT_PASSWORD_KEY = "encryptPassword";

export default function SignAndVerifyAction({ pageReady = false }) {
  const [signing, setSigning] = useState(false);
  const hoverCooldown = useRef(false);

  async function handleSign() {
    if (hoverCooldown.current) return;

    const tab = await getActiveTabSafe();
    if (!tab?.id) {
      toast.info("Open the tender preparation page before using Sign.");
      return;
    }

    const saved = await chrome.storage.local.get(ENCRYPT_PASSWORD_KEY);
    const password = saved?.[ENCRYPT_PASSWORD_KEY];
    if (!password) {
      toast.info("Enter and save a password before using Sign.");
      return;
    }

    hoverCooldown.current = true;
    try {
      setSigning(true);
      const result = await sendSignAndVerifyMessage(tab.id, password);
      console.log("[Sign] Response from page:", result);
      if (!result?.ok) {
        toast.info(result?.message || "No Sign button was found.");
      } else if (!result.verified) {
        toast.info(result?.message || "Sign clicked, but password verification did not start.");
      }
    } catch (error) {
      console.error(error);
      const errorMessage = String(error?.message || error);
      if (errorMessage.includes("Receiving end does not exist") || errorMessage.includes("Frame with ID 0 was removed")) {
        toast.info("Reload the target page, then try Sign again.");
      } else {
        toast.info("This page cannot be controlled by the extension.");
      }
    } finally {
      setSigning(false);
      window.setTimeout(() => {
        hoverCooldown.current = false;
      }, 1500);
    }
  }

  return (
    <PageActionButton pageReady={pageReady} className="default grow" onClick={handleSign} disabled={signing}>
      {signing ? "Signing..." : "Sign"}
    </PageActionButton>
  );
}
