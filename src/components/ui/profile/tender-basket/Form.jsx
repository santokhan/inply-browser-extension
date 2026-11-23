import { Plus } from "lucide-react";

export default function TenderIDForm({ tenderId, onTenderIdChange, onSubmit, disabled = false }) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Tender ID</span>
        <input type="number" inputMode="numeric" min="0" step="1" value={tenderId}
          onChange={(event) => onTenderIdChange(event.target.value.replace(/\D/g, ""))}
          onKeyDown={(event) => {
            if (!event.ctrlKey && !event.metaKey && !event.altKey && ["e", "E", "+", "-", "."].includes(event.key)) {
              event.preventDefault();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            onTenderIdChange(event.clipboardData.getData("text").replace(/\D/g, ""));
          }}
          placeholder="Tender ID"
          required disabled={disabled} className="default" />
      </label>
      <button type="submit" disabled={disabled || !tenderId.trim()} className="secondary flex items-center gap-1">
        <Plus size={14} aria-hidden="true" /> Add
      </button>
    </form>
  );
}
