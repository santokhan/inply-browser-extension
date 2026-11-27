import { useState } from "react";
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import BuildTableButton from "./BuildTableButton";

export default function NoticeDetails({ notice, onBack, onDelete, onRename, onAddTender, onRemoveTender, error }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(notice.name || "");
  const [tenderIds, setTenderIds] = useState([]);
  const tenders = Object.entries(notice.tenders || {});

  async function saveName() {
    const saved = await onRename(notice.id, name);
    if (saved) setEditingName(false);
  }

  return (
    <section className="space-y-3">
      <button type="button" className="secondary flex items-center gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Notices
      </button>
      <div className="flex items-center gap-2">
        {editingName ? <div className="flex min-w-0 flex-1 gap-1">
          <input autoFocus maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="default min-w-0 flex-1" aria-label="Notice name" />
          <button type="button" className="secondary p-1" aria-label="Save notice name" onClick={saveName}><Check size={14} /></button>
          <button type="button" className="secondary p-1" aria-label="Cancel editing notice name" onClick={() => { setName(notice.name || ""); setEditingName(false); }}><X size={14} /></button>
        </div> : <h3 className="min-w-0 flex-1 text-sm font-semibold text-gray-800">{notice.name || "Notice"}</h3>}
        {!editingName && <button type="button" className="secondary p-1" aria-label={`Edit notice ${notice.name || ""}`} onClick={() => setEditingName(true)}><Pencil size={14} /></button>}
        <button type="button" className="secondary p-1" aria-label={`Delete notice ${notice.name || ""}`} onClick={() => onDelete(notice.id)}><Trash2 size={14} /></button>
      </div>

      <BuildTableButton tenderId={tenders[0]?.[0]} />

      {tenders.length ? <ul className="space-y-2">{tenders.map(([id, details]) => <li key={id} className="flex items-start gap-2 rounded bg-gray-50 p-2 text-xs text-gray-600">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-700">Tender {id}</p>
          {details.title && <p>Title: {details.title}</p>}{details.type && <p>Type: {details.type}</p>}
          {details.est != null && <p>Estimate: {details.est}</p>}
        </div>
        <button type="button" className="secondary shrink-0 p-1" aria-label={`Remove tender ${id}`} title={`Remove tender ${id}`} onClick={() => onRemoveTender(notice.id, id)}><Trash2 size={14} /></button>
      </li>)}</ul> : <p className="text-xs text-gray-500">No tender IDs added.</p>}

      <div className="space-y-2">
        {tenderIds.map((id, index) => <label key={index} className="block">
          <span className="sr-only">New tender ID {index + 1}</span>
          <input inputMode="numeric" pattern="[0-9]+" value={id}
            onChange={(event) => setTenderIds((current) => current.map((value, i) => i === index ? event.target.value : value))}
            onBlur={() => onAddTender(notice.id, id)} placeholder="Tender ID (e.g. 1234567)" className="default w-full" />
        </label>)}
        <button type="button" className="secondary flex w-full items-center justify-center gap-1" onClick={() => setTenderIds((current) => [...current, ""])}>
          <Plus size={16} /> Add ID
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
