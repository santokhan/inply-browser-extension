import { useEffect, useRef, useState } from "react";
import { arrayRemove, arrayUnion, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Bot, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { db, tenantAuth } from "../../../firebase/config";
import { tenantCustomerPath } from "../../../data/tenantCustomerPaths";
import { normalizeTenderId } from "../../../utils/tenderBasket";
import { SITE_ORIGIN, SITE_URL, isSiteUrl } from "../../../config/site";
import { waitForLoginTab } from "../../../utils/customerLogin";
import { openMyTenders, searchMyTender } from "../../../utils/tenderMessaging";

export default function TenderBasket({ customer }) {
  const [tenderIds, setTenderIds] = useState([]);
  const [tenderId, setTenderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const tenantUid = tenantAuth.currentUser?.uid;

  useEffect(() => {
    setLoading(true);
    setError("");
    setTenderIds([]);
    if (!tenantUid || !customer.id) {
      setLoading(false);
      setError("Select a saved customer to manage tenders.");
      return;
    }
    return onSnapshot(doc(db, ...tenantCustomerPath(tenantUid, customer.id)), (snapshot) => {
      setLoading(false);
      if (!snapshot.exists()) {
        setError("This customer has been removed.");
        setTenderIds([]);
        return;
      }
      setTenderIds(snapshot.data().tenderIds ?? []);
      setError("");
    }, (err) => {
      setLoading(false);
      setError(err.message || "Could not load the tender basket.");
    });
  }, [tenantUid, customer.id]);

  function customerRef() {
    if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) {
      throw new Error("Sign in again to manage this tender basket.");
    }
    return doc(db, ...tenantCustomerPath(tenantUid, customer.id));
  }

  async function changeTender(event, removedId) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const id = removedId ?? normalizeTenderId(tenderId);
      if (!removedId && tenderIds.includes(id)) throw new Error("This tender is already in the basket.");
      await updateDoc(customerRef(), {
        tenderIds: removedId ? arrayRemove(id) : arrayUnion(id),
        updatedAt: serverTimestamp(),
      });
      if (!removedId) setTenderId("");
      setMessage(`Tender ${id} ${removedId ? "removed" : "added"}.`);
    } catch (err) {
      setError(err.message || "Could not update the tender basket.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  async function runTenderAutomation(id) {
    if (pending.current) return;
    pending.current = true;
    setOpening(true);
    setError("");
    setMessage("");
    try {
      let tab;
      const tabId = customer.profileTabId;
      if (Number.isInteger(tabId)) {
        try { tab = await chrome.tabs.get(tabId); } catch { /* Find another eProcure tab if the login tab was closed. */ }
      }
      if (!tab) {
        const tabs = await chrome.tabs.query({ url: `${SITE_ORIGIN}/*` });
        tabs.sort((first, second) => Number(Boolean(second.active)) - Number(Boolean(first.active)));
        tab = tabs[0] || await chrome.tabs.create({ url: SITE_URL, active: true });
      }
      if (!tab?.id || !isSiteUrl(tab.url || tab.pendingUrl)) {
        throw new Error("Open the customer's eProcure tab before opening My Tenders.");
      }
      await chrome.tabs.update(tab.id, { active: true });
      await waitForLoginTab(tab.id);
      const result = await openMyTenders(tab.id);
      if (!result?.ok) throw new Error(result?.message || "Could not open My Tenders.");
      const search = await searchMyTender(tab.id, id);
      if (!search?.ok) throw new Error(search?.message || "Could not search for this tender.");
      setMessage(search.message);
    } catch (error) {
      setError(error.message || "Could not open My Tenders.");
    } finally {
      pending.current = false;
      setOpening(false);
    }
  }

  const busy = saving || opening;

  return (
    <section aria-label={`Tender basket for ${customer.businessName || customer.email}`} className="mt-3 space-y-2 border-t border-gray-200 pt-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
        <ShoppingBasket size={16} aria-hidden="true" /> Tender basket
        <span className="text-xs font-normal text-gray-500">({tenderIds.length})</span>
      </h3>
      <form onSubmit={changeTender} className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Tender ID</span>
          <input type="number" inputMode="numeric" min="0" step="1" value={tenderId}
            onChange={(event) => setTenderId(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => {
              if (!event.ctrlKey && !event.metaKey && !event.altKey && ["e", "E", "+", "-", "."].includes(event.key)) {
                event.preventDefault();
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              setTenderId(event.clipboardData.getData("text").replace(/\D/g, ""));
            }}
            placeholder="Tender ID"
            required disabled={busy || loading} className="default" />
        </label>
        <button type="submit" disabled={busy || loading || !tenderId.trim()} className="secondary flex items-center gap-1">
          <Plus size={14} aria-hidden="true" /> Add
        </button>
      </form>
      {loading ? <p role="status" className="text-xs text-gray-500">Loading tenders...</p> : tenderIds.length === 0 ? (
        <p className="text-xs text-gray-500">Add a tender ID to automate it for this customer.</p>
      ) : (
        <ul className="space-y-1">
          {tenderIds.map((id) => (
            <li key={id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
              <span className="min-w-0 flex-1 break-all text-sm text-gray-800">{id}</span>
              <button type="button" disabled={busy}
                aria-label={`Search My Tenders for tender ${id}`} title="Search My Tenders"
                className="secondary flex shrink-0 items-center justify-center p-2"
                onClick={() => runTenderAutomation(id)}
              >
                <Bot size={16} />
              </button>
              <button type="button" onClick={(event) => changeTender(event, id)} disabled={busy}
                aria-label={`Remove tender ${id}`} title={`Remove tender ${id}`}
                className="secondary flex shrink-0 items-center justify-center p-2"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {message && <p role="status" className="text-xs text-green-700">{message}</p>}
    </section>
  );
}
