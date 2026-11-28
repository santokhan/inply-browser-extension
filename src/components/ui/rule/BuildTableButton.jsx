import { useEffect, useState } from "react";
import { Table } from "lucide-react";
import { toast } from "react-toastify";
import { getActiveTabSafe } from "../../../utils/chrome.js";
import { isSiteUrl } from "../../../config/site.js";
import { clickAllTendersLink } from "../../../utils/prepareNoticeAction.js";

function readTenderResult(tenderId) {
  const tables = [...document.querySelectorAll("table")];
  for (const table of tables) {
    const rows = [...table.querySelectorAll("tr")]
      .map((row) =>
        [...row.querySelectorAll("th, td")].map((cell) =>
          cell.innerText.trim(),
        ),
      )
      .filter((cells) => cells.length);
    const resultIndex = rows.findIndex((cells) =>
      cells.some((cell) => cell.split(/\s+/).includes(String(tenderId))),
    );
    if (resultIndex < 0) continue;

    const headerRows = rows
      .slice(0, resultIndex)
      .filter((cells) =>
        cells.some((cell) =>
          /tender\s*\/?\s*proposal\s*id|procurement nature/i.test(cell),
        ),
      );
    const headers = headerRows.at(-1) || rows[resultIndex - 1] || [];
    return {
      headers,
      rows: rows.slice(resultIndex).filter((cells) => cells.length),
    };
  }
  return null;
}

const TENDER_HEADERS = [
  "S. No.",
  "Tender/Proposal ID, Reference No.",
  "Procurement Nature, Title",
  "Ministry, Division, Organization, PE",
  "Type, Method",
  "Publishing Date and Time, Closing Date and Time",
];

function initialTable(tenderId) {
  return {
    headers: TENDER_HEADERS,
    rows: tenderId ? [["1", String(tenderId), "", "", "", ""]] : [],
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
          <colgroup>
            <col className="w-20" />
            <col className="w-72" />
            <col className="w-56" />
            <col className="w-64" />
            <col className="w-40" />
            <col className="w-64" />
          </colgroup>
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
