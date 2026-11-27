import { Plus, Wrench, X } from "lucide-react";

export default function NewNoticeForm({
  open,
  onOpen,
  onClose,
  activeNotice,
  noticeName,
  onNoticeNameChange,
  onCreate,
  tenderIds,
  onTenderIdChange,
  onSaveTenderId,
  onAddTenderField,
  onNewNotice,
  error,
}) {
  if (!open)
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-controls="new-notice-form"
        onClick={onOpen}
        className="secondary flex w-full items-center justify-center gap-2"
      >
        <Wrench size={16} aria-hidden="true" /> New Notice
      </button>
    );

  return (
    <section id="new-notice-form" aria-label="New notice" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">New Notice</h3>
        <button
          type="button"
          className="secondary p-1"
          aria-label="Close new notice form"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      {!activeNotice ? (
        <label
          className="block space-y-1 text-sm text-gray-700"
          htmlFor="notice-name"
        >
          <span>Notice name</span>
          <input
            id="notice-name"
            maxLength={120}
            value={noticeName}
            onChange={(event) => onNoticeNameChange(event.target.value)}
            onBlur={onCreate}
            placeholder="Enter notice name"
            className="default w-full"
          />
        </label>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">
            {activeNotice.name || "New notice"}
          </p>
          <div className="space-y-2">
            {tenderIds.map((id, index) => (
              <label
                key={index}
                className="block space-y-1 text-sm text-gray-700"
              >
                <span className="sr-only">Tender ID {index + 1}</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]+"
                  value={id}
                  onChange={(event) =>
                    onTenderIdChange(index, event.target.value)
                  }
                  onBlur={() => onSaveTenderId(index)}
                  placeholder="Tender ID (e.g. 1234567)"
                  className="default w-full"
                />
              </label>
            ))}
            <button
              type="button"
              className="secondary flex w-full items-center justify-center gap-1"
              onClick={onAddTenderField}
            >
              <Plus size={16} /> Add ID
            </button>
          </div>
          <button
            type="button"
            className="text-xs text-gray-500 underline"
            onClick={onNewNotice}
          >
            Create another notice
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
