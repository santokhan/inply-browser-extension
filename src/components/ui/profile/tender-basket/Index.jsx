import { useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { Bot, ShoppingBasket, Trash2 } from "lucide-react";
import { db, tenantAuth } from "../../../../firebase/config";
import { tenantCustomerPath, tenantCustomersPath, tenantTenderBasketPath } from "../../../../data/tenantCustomerPaths";
import { normalizeTenderId, updateTenderBasket } from "../../../../utils/tenderBasket";
import { SITE_ORIGIN, SITE_URL, isSiteUrl } from "../../../../config/site";
import { waitForLoginTab } from "../../../../utils/customerLogin";
import { openMyTenders, searchMyTender } from "../../../../utils/tenderMessaging";
import { getCustomerLtmForms } from "../../../../data/ltmTenderForms";
import { completeTenderAutomation } from "../../../../firebase/tenantWallet";
import TenderIDForm from "./Form";

function TenderIdRow({ id, busy, onSearch, onRemove }) {
  const [status, setStatus] = useState("pending");
  return (
    <li className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
      <span className="min-w-0 flex-1 break-all text-sm text-gray-800">{id}</span>
      
      <button type="button" disabled={busy}
        aria-label={`Search My Tenders for tender ${id}`} title="Search My Tenders"
        className="secondary flex shrink-0 items-center justify-center p-2"
        onClick={() => onSearch(() => setStatus("completed"))}
      >
        <Bot size={16} />
      </button>
      <button type="button" onClick={onRemove} disabled={busy}
        aria-label={`Remove tender ${id}`} title={`Remove tender ${id}`}
        className="secondary flex shrink-0 items-center justify-center p-2"><Trash2 size={16} /></button>
    </li>
  );
}

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
    if (!tenantUid) {
      setLoading(false);
      setError("Select a saved customer to manage tenders.");
      return;
    }
    let unsubscribe;
    let active = true;
    async function subscribeToBasket() {
      try {
        const basketRef = doc(db, ...tenantTenderBasketPath(tenantUid));
        const existing = await getDoc(basketRef);
        if (!active) return;
        if (!existing.exists()) {
          const legacyCustomers = await getDocs(collection(db, ...tenantCustomersPath(tenantUid)));
          const legacyBasket = legacyCustomers.docs.reduce((basket, customerSnapshot) => {
            const customerBasket = customerSnapshot.data();
            for (const id of customerBasket.tenderIds ?? []) {
              if (!basket.tenderIds.includes(id)) basket.tenderIds.push(id);
            }
            return basket;
          }, { tenderIds: [] });
          await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(basketRef);
            if (!snapshot.exists()) transaction.set(basketRef, legacyBasket);
          });
        }
        if (!active) return;
        unsubscribe = onSnapshot(basketRef, (snapshot) => {
          setLoading(false);
          setTenderIds(snapshot.data()?.tenderIds ?? []);
          setError("");
        }, (err) => {
          setLoading(false);
          setError(err.message || "Could not load the tender basket.");
        });
      } catch (err) {
        if (!active) return;
        setLoading(false);
        setError(err.message || "Could not load the tender basket.");
      }
    }
    subscribeToBasket();
    return () => { active = false; unsubscribe?.(); };
  }, [tenantUid]);

  function tenderBasketRef() {
    if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) {
      throw new Error("Sign in again to manage this tender basket.");
    }
    return doc(db, ...tenantTenderBasketPath(tenantUid));
  }

  async function saveTenderChange(change) {
    const ref = tenderBasketRef();
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      transaction.set(ref, {
        ...updateTenderBasket(snapshot.data() ?? {}, change),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
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
      await saveTenderChange({ action: removedId ? "remove" : "add", tenderId: id });
      if (!removedId) setTenderId("");
      setMessage(`Tender ${id} ${removedId ? "removed" : "added"}.`);
    } catch (err) {
      setError(err.message || "Could not update the tender basket.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  async function runTenderAutomation(id, onCompleted) {
    if (pending.current) return;
    pending.current = true;
    setOpening(true);
    setError("");
    setMessage("");
    try {
      const ref = doc(db, ...tenantCustomerPath(tenantUid, customer.id));
      const [ltmSnapshot, customerSnapshot] = await Promise.all([
        getDoc(doc(db, "ltmTenderForms", tenantUid)),
        getDoc(ref),
      ]);
      if (!customerSnapshot.exists()) throw new Error("This customer has been removed.");
      const forms = getCustomerLtmForms(ltmSnapshot.data(), { ...customer, ...customerSnapshot.data() });
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
      const result = await openMyTenders(tab.id, id);
      if (!result?.ok) throw new Error(result?.message || "Could not open My Tenders.");
      const search = await searchMyTender(tab.id, id, forms);
      if (!search?.ok) throw new Error(search?.message || "Could not search for this tender.");
      try {
        await completeTenderAutomation(tenantUid, id);
      } catch (cause) {
        throw new Error(`Tender ${id} automation finished, but its completion charge could not be saved. ${cause.message || "Check your wallet and retry."}`);
      }
      onCompleted?.();
      setMessage(`Tender ${id} automation completed.`);
    } catch (error) {
      setError(error.message || "Could not open My Tenders.");
    } finally {
      pending.current = false;
      setOpening(false);
    }
  }

  const busy = saving || opening;

  return (
    <section aria-label={`Tender basket for ${customer.businessName || customer.email}`} className="space-y-2 pt-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
        <ShoppingBasket size={16} aria-hidden="true" /> Tender basket
        <span className="text-xs font-normal text-gray-500">({tenderIds.length})</span>
      </h3>

      <TenderIDForm tenderId={tenderId} onTenderIdChange={setTenderId} onSubmit={changeTender} disabled={busy || loading} />

      {loading ? <p role="status" className="text-xs text-gray-500">Loading tenders...</p> : tenderIds.length === 0 ? (
        <p className="text-xs text-gray-500">Add a tender ID to automate it for this customer.</p>
      ) : (
        <ul className="space-y-1">
          {tenderIds.map((id) => (
            <TenderIdRow
              key={id}
              id={id}
              busy={busy}
              onSearch={(onCompleted) => runTenderAutomation(id, onCompleted)}
              onRemove={(event) => changeTender(event, id)}
            />
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {message && <p role="status" className="text-xs text-green-700">{message}</p>}
    </section>
  );
}
