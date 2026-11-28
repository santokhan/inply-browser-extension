import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { db, tenantAuth } from "../../../firebase/config";
import { normalizeTenderId } from "../../../utils/tenderBasket";
import NewNoticeForm from "./NewNoticeForm";
import NoticeDetails from "./NoticeDetails";
import NoticeList from "./NoticeList";

function getNoticeRouteId() {
  const match = window.location.hash.match(/^#\/notices\/([^/?#]+)/);
  if (!match) return "";
  try { return decodeURIComponent(match[1]); }
  catch { return ""; }
}

export default function Notices() {
  const tenantUid = tenantAuth.currentUser?.uid;
  const [tenderIds, setTenderIds] = useState([""]);
  const [noticeName, setNoticeName] = useState("");
  const [activeNoticeId, setActiveNoticeId] = useState("");
  const [noticeRouteId, setNoticeRouteId] = useState(() => getNoticeRouteId());
  const [notices, setNotices] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const updateRoute = () => setNoticeRouteId(getNoticeRouteId());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  useEffect(() => {
    if (!tenantUid) {
      setNotices([]);
      setLoading(false);
      return;
    }
    const noticesQuery = query(collection(db, "notices", tenantUid, "items"), orderBy("createdAt", "desc"));
    return onSnapshot(noticesQuery, (snapshot) => {
      setNotices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
      setError("");
    }, (err) => {
      setLoading(false);
      setError(err.message || "Could not load notices.");
    });
  }, [tenantUid]);

  async function saveTenderIdToNotice(noticeId, value) {
    if (!value?.trim()) return;
    const notice = notices.find((item) => item.id === noticeId);
    if (!notice) {
      setError("Create or select a notice first.");
      return;
    }
    try {
      const id = normalizeTenderId(value);
      if (Object.hasOwn(notice.tenders || {}, id)) return;
      await updateDoc(doc(db, "notices", tenantUid, "items", noticeId), {
        [`tenders.${id}`]: { est: null, title: "", type: "" },
      });
      setError("");
    } catch (err) {
      setError(err.message || "Could not add tender ID.");
    }
  }

  async function saveTenderResults(noticeId, tenderId, collectedData) {
    if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) {
      throw new Error("Sign in again to save tender results.");
    }
    const id = normalizeTenderId(tenderId);
    const firestoreSafeData = {
      rows: collectedData.rows.map((row) => ({
        tenderID: row.tenderID,
        procurementNature: row.procurementNature,
        title: row.title,
        ministry: row.ministry,
        division: row.division,
        pe: row.pe,
        procurementType: row.procurementType,
        organization: row.organization,
        procurementMethod: row.procurementMethod,
        publishingDate: row.publishingDate,
        closingDate: row.closingDate,
        sd: row.sd,
        bd: row.bd,
        credit: row.credit,
        est: row.est,
      })),
    };
    try {
      await updateDoc(doc(db, "notices", tenantUid, "items", noticeId), {
        [`tenders.${id}.collectedData`]: firestoreSafeData,
      });
      setError("");
    } catch (err) {
      setError(err.message || "Could not save tender results.");
      throw err;
    }
  }

  async function createNotice() {
    if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) {
      setError("Sign in again to create a notice.");
      return;
    }
    const name = noticeName.trim();
    if (!name || saving || activeNoticeId) return;
    setSaving(true);
    setError("");
    try {
      const noticeRef = doc(collection(db, "notices", tenantUid, "items"));
      await setDoc(noticeRef, { id: noticeRef.id, name, tenders: {}, createdAt: serverTimestamp() });
      setNotices((current) => [{ id: noticeRef.id, name, tenders: {} }, ...current]);
      setActiveNoticeId(noticeRef.id);
      setTenderIds([""]);
    } catch (err) {
      setError(err.message || "Could not create notice.");
    } finally {
      setSaving(false);
    }
  }

  async function removeNotice(id) {
    if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) return;
    setError("");
    try {
      await deleteDoc(doc(db, "notices", tenantUid, "items", id));
      if (activeNoticeId === id) {
        setActiveNoticeId("");
        setTenderIds([""]);
      }
      if (noticeRouteId === id) window.location.hash = "";
    } catch (err) {
      setError(err.message || "Could not delete notice.");
    }
  }

  async function removeTenderId(noticeId, tenderId) {
    if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) return;
    setError("");
    try {
      await updateDoc(doc(db, "notices", tenantUid, "items", noticeId), {
        [`tenders.${tenderId}`]: deleteField(),
      });
      setNotices((current) => current.map((notice) => notice.id === noticeId ? {
        ...notice,
        tenders: Object.fromEntries(Object.entries(notice.tenders || {}).filter(([id]) => id !== tenderId)),
      } : notice));
    } catch (err) {
      setError(err.message || "Could not remove tender ID.");
    }
  }

  async function saveNoticeName(id, value) {
    const name = value.trim();
    if (!name) {
      setError("Enter a notice name.");
      return false;
    }
    setError("");
    try {
      await updateDoc(doc(db, "notices", tenantUid, "items", id), { name });
      setNotices((current) => current.map((item) => item.id === id ? { ...item, name } : item));
      return true;
    } catch (err) {
      setError(err.message || "Could not update notice.");
      return false;
    }
  }

  const activeNotice = notices.find((notice) => notice.id === activeNoticeId);
  const routeNotice = notices.find((notice) => notice.id === noticeRouteId);

  return (
    <section aria-label="Notices" className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
      {noticeRouteId ? routeNotice ? (
        <NoticeDetails notice={routeNotice} onBack={() => { window.location.hash = ""; }} onDelete={removeNotice} onRename={saveNoticeName} onAddTender={saveTenderIdToNotice} onRemoveTender={removeTenderId} onSaveTenderResults={saveTenderResults} error={error} />
      ) : loading ? (
        <p className="text-xs text-gray-500">Loading notice...</p>
      ) : (
        <div className="space-y-2">
          <button type="button" className="secondary flex items-center gap-1" onClick={() => { window.location.hash = ""; }}><ArrowLeft size={14} /> Notices</button>
          <p role="status" className="text-xs text-gray-500">Notice not found.</p>
        </div>
      ) : <>
        <NewNoticeForm
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          activeNotice={activeNotice}
          noticeName={noticeName}
          onNoticeNameChange={setNoticeName}
          onCreate={createNotice}
          tenderIds={tenderIds}
          onTenderIdChange={(index, value) => setTenderIds((current) => current.map((item, i) => i === index ? value : item))}
          onSaveTenderId={(index) => saveTenderIdToNotice(activeNoticeId, tenderIds[index])}
          onAddTenderField={() => setTenderIds((current) => [...current, ""])}
          onNewNotice={() => { setActiveNoticeId(""); setNoticeName(""); setTenderIds([""]); }}
          error={error}
          saving={saving}
        />
        {!open && error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <NoticeList notices={notices} loading={loading} onOpen={(id) => { window.location.hash = `/notices/${encodeURIComponent(id)}`; }} onDelete={removeNotice} onRename={saveNoticeName} />
      </>}
    </section>
  );
}
