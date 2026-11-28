import { useEffect, useState } from "react";
import { Table } from "lucide-react";
import { toast } from "react-toastify";
import { getActiveTabSafe } from "../../../utils/chrome.js";
import { isSiteUrl } from "../../../config/site.js";
import { clickAllTendersLink } from "../../../utils/prepareNoticeAction.js";

async function readTenderResult(tenderId) {
  const table = document.querySelector("#resultTable");
  if (!table) return null;

  const headers = [...table.querySelectorAll("thead th")].map((cell) =>
    cell.innerText.replace(/\s+/g, " ").trim(),
  );
  const resultRows = [...table.querySelectorAll("tbody tr")]
    .map((row) => [...row.querySelectorAll("td")])
    .filter((cells) => cells.length === headers.length)
    .map((cells) => ({
      dashboardUrl: cells.at(-1)?.querySelector('a[title="Dashboard"]')?.href,
      values: cells.map((cell, index) => {
        if (index === 1) {
          return cell.querySelector('input[name="id"]')?.value ||
            cell.innerText.trim().split(",")[0].trim();
        }
        if (index === cells.length - 1) return null;
        return cell.innerText.replace(/\s+/g, " ").trim() ||
          cell.querySelector("a[title]")?.title ||
          "";
      }),
    }));

  const expectedId = String(tenderId).trim();
  if (!resultRows.some(({ values }) => values[1] === expectedId)) {
    return null;
  }

  const rows = await Promise.all(resultRows.map(async ({ dashboardUrl, values }) => {
    const dashboard = { SD: "", BD: "", CREDIT: "", EST: "" };
    if (dashboardUrl) {
      try {
        const response = await fetch(dashboardUrl, { credentials: "include" });
        if (response.ok) {
          const dashboardDocument = new DOMParser().parseFromString(await response.text(), "text/html");
          const dashboardTableRows = [...dashboardDocument.querySelectorAll("tr")]
            .map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.innerText.replace(/\s+/g, " ").trim()))
            .filter((cells) => cells.length);

          for (const field of Object.keys(dashboard)) {
            const labelPattern = new RegExp(`(^|\\b)${field}(\\b|$)`, "i");
            for (const cells of dashboardTableRows) {
              const labelIndex = cells.findIndex((cell) => labelPattern.test(cell));
              if (labelIndex < 0) continue;
              const labelAndValue = cells[labelIndex].split(/\s*:\s*/, 2);
              dashboard[field] = labelAndValue.length > 1
                ? labelAndValue[1].trim()
                : cells.slice(labelIndex + 1).find(Boolean) || "";
              if (dashboard[field]) break;
            }
          }
        }
      } catch (error) {
        console.warn("Could not read tender dashboard fields:", error);
      }
    }
    values[values.length - 1] = dashboard;
    return values;
  }));

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

function restoreCollectedData(data) {
  const sortByIndex = ([first], [second]) =>
    Number(first.slice(1)) - Number(second.slice(1));
  const headers = Array.isArray(data.headers)
    ? data.headers
    : Object.entries(data.headers || {}).sort(sortByIndex).map(([, header]) => header);
  const rows = Array.isArray(data.rows)
    ? data.rows.map((row, index) => [`r${index}`, row])
    : Object.entries(data.rows || {}).sort(sortByIndex);

  return {
    headers,
    rows: rows.map(([, row]) =>
      Array.isArray(row)
        ? row
        : headers.map((_, index) => row[`c${index}`] ?? ""),
    ),
  };
}

function initialTable(tenderIds, savedDataByTender = {}) {
  const saved = tenderIds
    .map((id) => savedDataByTender[id])
    .filter((data) => data?.headers && data.rows);
  if (saved.length) {
    const restored = saved.map(restoreCollectedData);
    return {
      headers: restored[0].headers,
      rows: restored.flatMap((data) => data.rows),
    };
  }
  return {
    headers: TENDER_HEADERS,
    rows: tenderIds.map((id, index) => [
      String(index + 1), String(id), "", "", "", "",
      { SD: "", BD: "", CREDIT: "", EST: "" },
    ]),
  };
}

export default function BuildTableButton({ tenderIds = [], savedDataByTender, onSave }) {
  const [building, setBuilding] = useState(false);
  const [table, setTable] = useState(() => initialTable(tenderIds, savedDataByTender));

  useEffect(() => {
    setTable(initialTable(tenderIds, savedDataByTender));
  }, [tenderIds, savedDataByTender]);

  async function buildTable() {
    if (building) return;
    if (!tenderIds.length) {
      toast.info("Add a tender ID to this notice first.");
      return;
    }

    setBuilding(true);
    setTable(initialTable(tenderIds));
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

      const collected = [];
      const missing = [];
      for (const tenderId of tenderIds) {
        const search = await clickAllTendersLink(tab.id, { tenderId });
        if (!search?.ok) {
          missing.push(tenderId);
          continue;
        }

        const deadline = Date.now() + 30000;
        let result = null;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 900));
          const currentTab = await getActiveTabSafe();
          if (
            !currentTab?.id ||
            !isSiteUrl(currentTab.url) ||
            currentTab.status !== "complete"
          ) continue;

          const [execution] = await chrome.scripting.executeScript({
            target: { tabId: currentTab.id, frameIds: [0] },
            func: readTenderResult,
            args: [tenderId],
          });
          if (execution?.result) {
            result = execution.result;
            break;
          }
        }

        if (!result) {
          missing.push(tenderId);
          continue;
        }
        collected.push(...result.rows);
        setTable({ headers: result.headers, rows: [...collected] });
        try {
          await onSave?.(tenderId, result);
        } catch (error) {
          console.error(`Could not save tender ${tenderId} results:`, error);
          toast.error(`Tender ${tenderId} was collected, but could not be saved to Firebase.`);
        }
      }
      if (missing.length) {
        toast.info(`No result found for tender ID${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
      }
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
                    {cellIndex === 0 ? rowIndex + 1 : cell && typeof cell === "object" ? (
                      <div className="space-y-0.5">
                        {Object.entries(cell).map(([field, value]) => (
                          <div key={field}>
                            <span className="font-medium">{field}:</span> {value || "—"}
                          </div>
                        ))}
                      </div>
                    ) : cell || "—"}
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
