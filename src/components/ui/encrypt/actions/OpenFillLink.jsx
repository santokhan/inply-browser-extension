import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { openFirstFillLink } from "../../../../content/tender.js";
import { isSiteUrl } from "../../../../config/site.js";
import { getActiveTabSafe } from "../../../../utils/chrome.js";

export default function OpenFillLink() {
  const [opening, setOpening] = useState(false);
  const inFlight = useRef(false);

  async function handleOpen() {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    try {
      const tab = await getActiveTabSafe();
      if (!tab?.id || !isSiteUrl(tab.url)) {
        toast.info("Open the eProcure tender preparation page before using Fill Opener.");
        return;
      }
      if (tab.status !== "complete") {
        toast.info("Wait for the page to finish loading, then try Fill Opener again.");
        return;
      }
      const [execution] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        func: openFirstFillLink,
      });
      if (!execution?.result?.ok) {
        toast.info(execution?.result?.message || "No Fill link was found on this page.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not open the Fill link. Check the active eProcure page and try again.");
    } finally {
      inFlight.current = false;
      setOpening(false);
    }
  }

  return (
    <button type="button" className="default w-full" onClick={handleOpen} disabled={opening}>
      {opening ? "Opening Fill..." : "Fill Opener"}
    </button>
  );
}
