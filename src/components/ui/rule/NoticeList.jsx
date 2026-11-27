import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";

export default function NoticeList({ notices, loading, onOpen, onDelete, onRename }) {
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");

  async function saveName(notice) {
    if (await onRename(notice.id, name)) setEditingId("");
  }

  if (loading) return <p className="text-xs text-gray-500">Loading notices...</p>;
  if (!notices.length) return null;

  return <ul className="space-y-2">{notices.map((notice) => <li key={notice.id} className="flex items-center gap-2 rounded bg-gray-50 p-2">
    <div className="min-w-0 flex-1">
      {editingId === notice.id ? <div className="flex items-center gap-1">
        <input autoFocus maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="default min-w-0 flex-1" aria-label="Notice name" />
        <button type="button" className="secondary shrink-0 p-1" aria-label="Save notice name" onClick={() => saveName(notice)}><Check size={14} /></button>
        <button type="button" className="secondary shrink-0 p-1" aria-label="Cancel editing notice name" onClick={() => setEditingId("")}><X size={14} /></button>
      </div> : <button type="button" className="text-left text-xs font-medium text-gray-700 transition-colors hover:text-primary-700" onClick={() => onOpen(notice.id)}>{notice.name || "Notice"}</button>}
    </div>
    {editingId !== notice.id && <>
      <button type="button" className="secondary shrink-0 p-1" aria-label={`Edit notice ${notice.name || ""}`} onClick={() => { setEditingId(notice.id); setName(notice.name || ""); }}><Pencil size={14} /></button>
      <button type="button" className="secondary shrink-0 p-1" aria-label={`Delete notice ${notice.name || ""}`} onClick={() => onDelete(notice.id)}><Trash2 size={14} /></button>
    </>}
  </li>)}</ul>;
}
