import { useEffect, useState } from "react";
import { Table } from "lucide-react";
import { toast } from "react-toastify";
import { getActiveTabSafe } from "../../../utils/chrome.js";
import { isSiteUrl } from "../../../config/site.js";
import { clickAllTendersLink } from "../../../utils/prepareNoticeAction.js";

function readTenderResult(tenderId) {
  const table = document.querySelector("#resultTable");
  if (!table) return null;

  const headers = [...table.querySelectorAll("thead th")].map((cell) =>
    cell.innerText.replace(/\s+/g, " ").trim(),
  );
  const rows = [...table.querySelectorAll("tbody tr")]
    .map((row) => [...row.querySelectorAll("td")])
    .filter((cells) => cells.length === headers.length)
    .map((cells) =>
      cells.map((cell) =>
        cell.innerText.replace(/\s+/g, " ").trim() ||
        cell.querySelector("a[title]")?.title ||
        "",
      ),
    );

  const expectedId = String(tenderId).trim();
  if (!rows.some((row) => row[1]?.split(/[\s,]+/).includes(expectedId))) {
    return null;
  }
  return { headers, rows };
}

const TENDER_HEADERS = [
  "S. No.",
  "Tender/Proposal ID, Reference No.",
  "Procurement Nature, Title",
  "Ministry, Division, Organization, PE",
  "Type, Method",
  "Publishing Date, Closing Date",
  "Dashboard",
];

function initialTable(tenderId) {
  return {
    headers: TENDER_HEADERS,
    rows: tenderId ? [["1", String(tenderId), "", "", "", "", ""]] : [],
  };
}

export default function BuildTableButton({ tenderId }) {
  const [building, setBuilding] = useState(false);
  const [table, setTable] = useState(() => initialTable(tenderId));

  useEffect(() => {
    setTable(initialTable(tenderId));
  }, [tenderId]);

  async function buildTable() {
    if (building) return;
    if (!tenderId) {
      toast.info("Add a tender ID to this notice first.");
      return;
    }

    setBuilding(true);
    setTable(initialTable(tenderId));
    try {
      const tab = await getActiveTabSafe();
      if (!tab?.id || !isSiteUrl(tab.url)) {
        toast.info("Open the eProcure page before building the table.");
        return;
      }
      if (tab.status !== "complete") {
        toast.info(
          "Wait for the eProcure page to finish loading, then try again.",
        );
        return;
      }

      const result = await clickAllTendersLink(tab.id, { tenderId });
      if (!result?.ok) {
        toast.info(result?.message || "Could not open All Tenders.");
        return;
      }

      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        const currentTab = await getActiveTabSafe();
        if (
          !currentTab?.id ||
          !isSiteUrl(currentTab.url) ||
          currentTab.status !== "complete"
        )
          continue;

        const [execution] = await chrome.scripting.executeScript({
          target: { tabId: currentTab.id, frameIds: [0] },
          func: readTenderResult,
          args: [tenderId],
        });
        if (execution?.result) {
          setTable(execution.result);
          return;
        }
      }
      toast.info(`No search result found for tender ${tenderId}.`);
    } catch (error) {
      console.error(error);
      toast.error(
        "Could not build the tender table. Check the active eProcure tab and try again.",
      );
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="secondary flex w-full items-center justify-center gap-2"
        onClick={buildTable}
        disabled={building}
      >
        <Table size={16} aria-hidden="true" />{" "}
        {building ? "Building..." : "Build Table"}
      </button>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full min-w-300 text-left text-xs text-gray-600">
          {table.headers.length > 0 && (
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                {table.headers.map((header, index) => (
                  <th key={index} className="px-2 py-1.5 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {table.rows.length ? table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-gray-200">
                  {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-2 py-1.5">
                      {cellIndex === 0 ? rowIndex + 1 : cell || "—"}
                  </td>
                ))}
              </tr>
            )) : (
              <tr className="border-t border-gray-200">
                <td colSpan={table.headers.length} className="px-2 py-1.5">
                  Add a tender ID to this notice.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
