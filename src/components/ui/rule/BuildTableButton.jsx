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
    .map((tableRow) => {
      const [, tenderCell, natureCell, organizationCell, methodCell, dateCell] =
        tableRow.querySelectorAll("td");
      const [publishingDate = "", closingDate = ""] = (
        dateCell?.innerText.replace(/\s+/g, " ").trim() ||
        dateCell?.querySelector("a[title]")?.title ||
        ""
      )
        .split(",")
        .map((date) => date.trim());
      const [procurementType = "", procurementMethod = ""] = (
        methodCell?.innerText.replace(/\s+/g, " ").trim() || ""
      )
        .split(",")
        .map((value) => value.trim());
      const [procurementNature = "", title = ""] = (
        natureCell?.innerText.replace(/\s+/g, " ").trim() || ""
      )
        .split(",")
        .map((value) => value.trim());
      const [ministry = "", division = "", organization = "", pe = ""] = (
        organizationCell?.innerText.replace(/\s+/g, " ").trim() || ""
      )
        .split(",")
        .map((value) => value.trim());
      return {
        tenderID:
          tenderCell?.querySelector('input[name="id"]')?.value ||
          tenderCell?.innerText.trim().split(",")[0].trim() ||
          "",
        procurementNature,
        title,
        ministry,
        division,
        organization,
        pe,
        procurementType,
        procurementMethod,
        publishingDate,
        closingDate,
        hasExpectedColumns:
          tableRow.querySelectorAll("td").length === headers.length,
      };
    })
    .filter((row) => row.hasExpectedColumns);

  const expectedId = String(tenderId).trim();
  const matchingRow = resultRows.find((row) => row.tenderID === expectedId);
  if (!matchingRow) {
    return null;
  }

  const { hasExpectedColumns, ...tenderData } = matchingRow;
  return { rows: [tenderData] };
}

function restoreCollectedData(data) {
  if (!data?.rows) {
    return { rows: data?.tenderID ? [data] : [] };
  }

  const rows = Array.isArray(data.rows)
    ? data.rows.map((row, index) => [`r${index}`, row])
    : Object.entries(data.rows || {}).sort(
        ([first], [second]) => Number(first.slice(1)) - Number(second.slice(1)),
      );

  return {
    rows: rows.map(([, row]) => {
      const { dashboard, sd, bd, credit, est, ...fields } = row;
      const dateParts = fields.publishingDate
        ?.split(",")
        .map((date) => date.trim());
      return {
        ...fields,
        ...(!fields.closingDate && dateParts?.length > 1
          ? { publishingDate: dateParts[0], closingDate: dateParts[1] }
          : {}),
      };
    }),
  };
}

function initialTable(tenderIds, savedDataByTender = {}) {
  const saved = tenderIds
    .map((id) => savedDataByTender[id])
    .filter((data) => data?.rows || data?.tenderID);
  if (saved.length) {
    const restored = saved.map(restoreCollectedData);
    return {
      rows: restored.flatMap((data) => data.rows),
    };
  }
  return {
    rows: tenderIds.map((id) => ({
      tenderID: String(id),
      procurementNature: "",
      title: "",
      ministry: "",
      division: "",
      procurementType: "",
      organization: "",
      pe: "",
      procurementMethod: "",
      publishingDate: "",
      closingDate: "",
    })),
  };
}

export default function BuildTableButton({
  tenderIds = [],
  savedDataByTender,
  onSave,
}) {
  const [building, setBuilding] = useState(false);
  const [table, setTable] = useState(() =>
    initialTable(tenderIds, savedDataByTender),
  );

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
          )
            continue;

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
        const existingTenderIds = new Set(collected.map((row) => row.tenderID));
        for (const row of result.rows) {
          if (!existingTenderIds.has(row.tenderID)) {
            collected.push(row);
            existingTenderIds.add(row.tenderID);
          }
        }
        setTable({ rows: [...collected] });
        try {
          await onSave?.(tenderId, result);
        } catch (error) {
          console.error(`Could not save tender ${tenderId} results:`, error);
          toast.error(
            `Tender ${tenderId} was collected, but could not be saved to Firebase.`,
          );
        }
      }
      if (missing.length) {
        toast.info(
          `No result found for tender ID${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
        );
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
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-2 py-1.5 font-medium">S. No.</th>
              <th className="px-2 py-1.5 font-medium">Tender/Proposal ID</th>
              <th className="px-2 py-1.5 font-medium">
                Procurement Nature, Title
              </th>
              <th className="px-2 py-1.5 font-medium">
                Ministry, Division, Organization, PE
              </th>
              <th className="w-32 px-2 py-1.5 font-medium">Type, Method</th>
              <th className="w-40 px-2 py-1.5 font-medium">
                Publishing Date,
                <br /> Closing Date
              </th>
              <th className="w-48 px-2 py-1.5 font-medium">Dashboard</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.length ? (
              table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-gray-200">
                  <td className="px-2 py-1.5">{rowIndex + 1}</td>
                  <td className="px-2 py-1.5">{row.tenderID}</td>
                  <td className="px-2 py-1.5">
                    <strong>{row.procurementNature}</strong>,
                    <br />{row.title}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.ministry},
                    <br />{row.division},
                    <br />{row.organization},
                    <br />{row.pe}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.procurementType},
                    <br />{row.procurementMethod}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.publishingDate},
                    <br />{row.closingDate}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="space-y-0.5">
                      <p title="Price">
                        <strong>Price:</strong> {row.sd}
                      </p>
                      <p title="Security">
                        <strong>Security:</strong> {row.bd}
                      </p>
                      <p title="Bank Credit">
                        <strong>Credit:</strong> {row.credit}
                      </p>
                      <p title="Estimated Project Cost">
                        <strong>EST:</strong> {row.est}
                      </p>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-gray-200">
                <td colSpan={7} className="px-2 py-1.5">
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
