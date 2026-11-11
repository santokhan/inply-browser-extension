import { useRef, useState } from "react";
import { ArrowRight, Building2, Check, CircleAlert, Landmark, LoaderCircle, MapPin } from "lucide-react";
import useCustomerSession from "../../../hooks/useCustomerSession";

const DETAILS = [
  { field: "businessName", label: "Business name", source: "Company Details", Icon: Building2 },
  { field: "registeredAddress", label: "Registered address", source: "Company Details", Icon: MapPin },
  { field: "bankName", label: "Bank name", source: "Bank Details", Icon: Landmark },
];

function CollectBusinessDetails({ customer }) {
  const { collectBusinessDetails } = useCustomerSession();
  const collecting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const completed = DETAILS.filter(({ field }) => customer?.[field]?.trim()).length;

  async function collectBusinessData() {
    if (collecting.current) return;
    collecting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await collectBusinessDetails();
      if (result.remaining.length) {
        const missing = DETAILS.filter(({ field }) => result.remaining.includes(field)).map(({ label }) => label.toLowerCase());
        setMessage(`Saved the available details. Still needed — ${missing.join(", ")}.`);
        setError(result.message || "Check that these details are available in the customer's eProcure profile, then try again.");
      }
    } catch (error) {
      setError(error.message || "Could not collect business details. Try again.");
    } finally {
      collecting.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="business-details-heading" aria-busy={busy} className="mx-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-primary-200/60 bg-gradient-to-br from-primary-100 via-white to-indigo-50 p-4">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-primary-200 bg-white text-primary-600 shadow-sm">
          <Building2 size={22} aria-hidden="true" />
        </div>
        <h2 id="business-details-heading" className="text-base font-semibold tracking-tight text-gray-900">Complete your business profile</h2>
        <p className="mt-1 text-sm leading-5 text-gray-500">Collect your company and bank details from eProcure to get your LTM forms ready.</p>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="font-medium text-primary-700">Profile readiness</span>
          <span className="text-gray-500">{completed} of {DETAILS.length} details saved</span>
        </div>
        <div role="progressbar" aria-label="Business profile completion" aria-valuemin={0} aria-valuemax={DETAILS.length} aria-valuenow={completed} className="mt-2 flex gap-1.5">
          {DETAILS.map(({ field }, index) => (
            <span key={field} className={`h-1.5 flex-1 rounded-full ${index < completed ? "bg-primary-500" : "bg-primary-200/60"}`} />
          ))}
        </div>
      </div>

      <dl className="divide-y divide-gray-100 px-4">
        {DETAILS.map(({ field, label, source, Icon }) => {
          const value = customer?.[field]?.trim();
          return (
            <div key={field} className="flex items-start gap-3 py-3.5">
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${value ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="flex flex-wrap items-center justify-between gap-1 text-xs font-medium text-gray-700">
                  {label}
                  {value ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700"><Check size={12} aria-hidden="true" />Saved</span>
                    : <span className="text-[10px] font-normal text-amber-700">To collect</span>}
                </dt>
                <dd className={`mt-1 whitespace-pre-wrap break-words text-xs leading-5 ${value ? "text-gray-600" : "text-gray-400"}`}>
                  {value || `From ${source}`}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>

      <div className="space-y-3 border-t border-gray-100 bg-gray-50/70 p-4">
        <p className="text-xs leading-5 text-gray-500">Your eProcure tab will open to View Profile. Keep it open while we collect and save your missing details.</p>
        {message && <p role="status" className="rounded-lg border border-primary-200 bg-primary-100 p-2.5 text-xs leading-5 text-primary-800">{message}</p>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs leading-5 text-red-700"><CircleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" /><p>{error}</p></div>}
        <button type="button" onClick={collectBusinessData} disabled={busy} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70">
          {busy ? <LoaderCircle size={16} aria-hidden="true" className="motion-safe:animate-spin" /> : <ArrowRight size={16} aria-hidden="true" />}
          {busy ? "Collecting business details…" : error ? "Try collecting again" : "Collect business data"}
        </button>
        <p role="status" className="text-center text-[11px] leading-4 text-gray-400">{busy ? "Reading your eProcure profile. This may take up to 2 minutes." : "Details are saved to this customer for future forms."}</p>
      </div>
    </section>
  );
}

export { CollectBusinessDetails };
