import { useState } from "react";
import { Table } from "lucide-react";
import { toast } from "react-toastify";
import { getActiveTabSafe } from "../../../utils/chrome.js";
import { isSiteUrl } from "../../../config/site.js";
import { clickAllTendersLink } from "../../../utils/prepareNoticeAction.js";

export default function BuildTableButton({ tenderId }) {
  const [opening, setOpening] = useState(false);

  async function openAllTenders() {
    if (opening) return;
    if (!tenderId) {
      toast.info("Add a tender ID to this notice first.");
      return;
    }
    setOpening(true);
    try {
      const tab = await getActiveTabSafe();
      if (!tab?.id || !isSiteUrl(tab.url)) {
        toast.info("Open the eProcure page before building the table.");
        return;
      }
      if (tab.status !== "complete") {
        toast.info("Wait for the eProcure page to finish loading, then try again.");
        return;
      }
      const result = await clickAllTendersLink(tab.id, { tenderId });
      if (!result?.ok) toast.info(result?.message || "Could not open All Tenders.");
    } catch (error) {
      console.error(error);
      toast.error("Could not open All Tenders. Check the active eProcure tab and try again.");
    } finally {
      setOpening(false);
    }
  }

  return <button type="button" className="secondary flex w-full items-center justify-center gap-2" onClick={openAllTenders} disabled={opening}>
    <Table size={16} aria-hidden="true" /> {opening ? "Opening..." : "Build Table"}
  </button>;
}
