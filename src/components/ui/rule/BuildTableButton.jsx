import { useEffect, useState } from "react";
import { Table } from "lucide-react";
import { toast } from "react-toastify";
import { getActiveTabSafe } from "../../../utils/chrome.js";
import { isSiteUrl } from "../../../config/site.js";
import { clickAllTendersLink } from "../../../utils/prepareNoticeAction.js";

function parseNumericAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

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

function openTenderBrief(tenderId) {
  const expectedId = String(tenderId).trim();
  const rows = [...document.querySelectorAll("#resultTable tbody tr")];
  const matchingRow = rows.find((row) => {
    const id = row.querySelector('input[name="id"]')?.value
      || row.querySelectorAll("td")[1]?.innerText.trim().split(",")[0].trim();
    return id === expectedId;
  });
  if (!matchingRow) return { ok: false, message: "Tender row was not found." };

  const brief = matchingRow.querySelector('[id^="tenderBrief_"]');
  const anchor = brief?.closest("a");
  const formId = brief?.id.replace("tenderBrief_", "viewtenderform_");
  const form = formId ? document.getElementById(formId) : null;
  if (!anchor || !form) {
    return { ok: false, message: "Tender brief link was not found." };
  }

  form.target = "_self";
  anchor.click();
  return { ok: true };
}

function readTenderPage() {
  if (!document.body?.innerText?.trim()) {
    return { ok: false, message: "Tender page text is empty." };
  }

  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const parseAmount = (value) => {
    const normalized = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
    if (!normalized) return null;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
  };
  const findLabeledValue = (pattern) => {
    for (const row of document.querySelectorAll("#print_area tr")) {
      const cells = [...row.cells];
      for (let index = 0; index < cells.length - 1; index += 1) {
        if (pattern.test(normalize(cells[index].innerText))) {
          const valueCell = cells.slice(index + 1).find((cell) => {
            const text = normalize(cell.innerText);
            return text && !cell.classList.contains("ff") && !/:$/.test(text);
          });
          return normalize(valueCell?.innerText || "");
        }
      }
    }
    return "";
  };

  let security = null;
  for (const table of document.querySelectorAll("#print_area table")) {
    const headerRow = [...table.rows].find((row) =>
      [...row.cells].some((cell) => /tender\/proposal security/i.test(normalize(cell.innerText))),
    );
    if (!headerRow) continue;
    const securityColumn = [...headerRow.cells].findIndex((cell) =>
      /tender\/proposal security/i.test(normalize(cell.innerText)),
    );
    const amounts = [...table.rows]
      .filter((row) => row !== headerRow && row.cells.length > securityColumn)
      .map((row) => parseAmount(row.cells[securityColumn]?.innerText));
    const validAmounts = amounts.filter((amount) => amount !== null);
    security = validAmounts.length
      ? validAmounts.reduce((total, amount) => total + amount, 0)
      : null;
    break;
  }

  const bankDraft = parseAmount(findLabeledValue(/bank draft(?: amount)?/i)
    || findLabeledValue(/tender\/proposal document price\s*\(in bdt\)/i));
  const estimatedCost = parseAmount(findLabeledValue(
    /(?:estimated\s+(?:project\s+)?cost|estimated\s+(?:tender\s+)?value|project\s+cost|engineer(?:'s)?\s+estimate)/i,
  ));

  return {
    ok: true,
    security,
    bankDraft,
    estimatedCost,
  };
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
      const { dashboard, sd, bd, est, ...fields } = row;
      const dateParts = fields.publishingDate
        ?.split(",")
        .map((date) => date.trim());
      return {
        ...fields,
        security: parseNumericAmount(fields.security),
        bankDraft: parseNumericAmount(fields.bankDraft),
        credit: parseNumericAmount(fields.credit),
        estimatedCost: parseNumericAmount(fields.estimatedCost),
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
      security: null,
      bankDraft: null,
      credit: null,
      estimatedCost: null,
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
      let lastCollectedTenderId = "";
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
          const currentTab = await chrome.tabs.get(tab.id);
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
        const savedTender = savedDataByTender?.[String(tenderId)];
        const savedCredit = parseNumericAmount(
          savedTender?.credit ?? savedTender?.rows?.[0]?.credit,
        );
        const resultWithCredit = {
          rows: result.rows.map((row) => ({
            ...row,
            credit: parseNumericAmount(row.credit) ?? savedCredit,
          })),
        };
        const existingTenderIds = new Set(collected.map((row) => row.tenderID));
        for (const row of resultWithCredit.rows) {
          if (!existingTenderIds.has(row.tenderID)) {
            collected.push(row);
            existingTenderIds.add(row.tenderID);
          }
        }
        setTable({ rows: [...collected] });
        lastCollectedTenderId = tenderId;
        try {
          await onSave?.(tenderId, resultWithCredit);
        } catch (error) {
          console.error(`Could not save tender ${tenderId} results:`, error);
          toast.error(
            `Tender ${tenderId} was collected, but could not be saved to Firebase.`,
          );
        }
      }
      if (lastCollectedTenderId) {
        const currentTab = await chrome.tabs.get(tab.id);
        if (currentTab?.id && isSiteUrl(currentTab.url)) {
          const [execution] = await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds: [0] },
            func: openTenderBrief,
            args: [lastCollectedTenderId],
          });
          if (!execution?.result?.ok) {
            console.warn("Could not open the collected tender brief:", execution?.result?.message);
          } else {
            const previousUrl = currentTab.url;
            const deadline = Date.now() + 30000;
            let page = null;
            while (Date.now() < deadline) {
              await new Promise((resolve) => setTimeout(resolve, 900));
              const tenderTab = await chrome.tabs.get(tab.id);
              if (
                !tenderTab?.url ||
                tenderTab.url === previousUrl ||
                tenderTab.status !== "complete" ||
                !isSiteUrl(tenderTab.url)
              ) continue;

              try {
                const [pageExecution] = await chrome.scripting.executeScript({
                  target: { tabId: tab.id, frameIds: [0] },
                  func: readTenderPage,
                });
                if (pageExecution?.result?.ok) {
                  page = pageExecution.result;
                  break;
                }
              } catch {
                // The tab may still be transitioning between eProcure pages.
              }
            }

            if (page) {
              const collectedRow = collected.find(
                (row) => row.tenderID === String(lastCollectedTenderId).trim(),
              );
              if (collectedRow) {
                const tenderDetails = {
                  ...collectedRow,
                  security: page.security,
                  bankDraft: page.bankDraft,
                  estimatedCost: page.estimatedCost,
                };
                setTable({
                  rows: collected.map((row) =>
                    row.tenderID === collectedRow.tenderID ? tenderDetails : row,
                  ),
                });
                try {
                  await onSave?.(lastCollectedTenderId, {
                    rows: [tenderDetails],
                  });
                } catch (error) {
                  console.error(`Could not save tender ${lastCollectedTenderId} details:`, error);
                  toast.error(`Tender ${lastCollectedTenderId} was opened, but its details could not be saved.`);
                }
              }
            } else {
              console.warn("Could not read the collected tender brief before the timeout.");
            }
          }
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
              <th className="w-48 px-2 py-1.5 font-medium">Financial Details</th>
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
                      <p title="Bank Draft">
                        <strong>Bank Draft:</strong> {row.bankDraft || "—"}
                      </p>
                      <p title="Tender Security">
                        <strong>Security:</strong> {row.security || "—"}
                      </p>
                      <p title="Credit">
                        <strong>Credit:</strong> {row.credit || "—"}
                      </p>
                      <p title="Estimated Project Cost">
                        <strong>EST:</strong> {row.estimatedCost || "—"}
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
