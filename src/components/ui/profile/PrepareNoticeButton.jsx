import { useState } from "react";
import { Table } from "lucide-react";
import { toast } from "react-toastify";
import { getActiveTabSafe } from "../../../utils/chrome.js";
import { isSiteUrl } from "../../../config/site.js";
import { clickAllTendersLink } from "../../../utils/prepareNoticeAction.js";

export default function PrepareNoticeButton() {
  const [opening, setOpening] = useState(false);

  async function prepareNotice() {
    if (opening) return;
    setOpening(true);
    try {
      const tab = await getActiveTabSafe();
      if (!tab?.id || !isSiteUrl(tab.url)) {
        toast.info("Open the eProcure page before preparing a notice.");
        return;
      }
      if (tab.status !== "complete") {
        toast.info("Wait for the eProcure page to finish loading, then try again.");
        return;
      }
      const result = await clickAllTendersLink(tab.id);
      if (!result?.ok) {
        toast.info(result?.message || "Could not open All Tenders.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not open All Tenders. Check the active eProcure tab and try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <button type="button" onClick={prepareNotice} disabled={opening} className="secondary w-full flex items-center justify-center gap-2">
      <Table className="size-5" /> {opening ? "Opening All Tenders..." : "Prepare Notice"}
    </button>
  );
}
