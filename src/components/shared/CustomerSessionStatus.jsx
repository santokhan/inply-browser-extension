import { useState } from "react";
import { LogOut } from "lucide-react";
import { useTenantAuth } from "../../hooks/useTenantAuth";
import useCustomerSession from "../../hooks/useCustomerSession";

function getCustomerInitial(name) {
  const nameWithoutPrefix = name.trim().replace(/^(?:m\/s|ms)\b\.?\s*/i, "");
  return (Array.from(nameWithoutPrefix)[0] || "C").toUpperCase();
}

export default function CustomerSessionStatus() {
  const { tenant } = useTenantAuth();
  const { currentCustomer, signOutCustomer } = useCustomerSession();
  const [signingOutCustomer, setSigningOutCustomer] = useState(false);
  const [error, setError] = useState("");

  async function handleCustomerSignOut() {
    setSigningOutCustomer(true);
    setError("");
    try {
      await signOutCustomer();
    } catch (error) {
      setError(error.message || "Could not log the customer out of e-GP.");
    } finally {
      setSigningOutCustomer(false);
    }
  }

  if (!tenant) return null;

  const customerName = currentCustomer?.businessName?.trim() || currentCustomer?.email || "Customer";
  const customerInitial = getCustomerInitial(customerName);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-700">
      {currentCustomer ? <div role="status" className="flex items-center gap-1">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
          {customerInitial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" title={customerName}>{customerName}</p>
          {currentCustomer.businessName?.trim() &&
            <p
              className="truncate text-gray-500"
              title={JSON.stringify(currentCustomer, null, 2)}
            >{currentCustomer.email}</p>
          }
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-green-500" />
          Active
        </span>
        <button
          type="button"
          onClick={handleCustomerSignOut}
          aria-label="Log customer out of e-GP"
          title={signingOutCustomer ? "Logging out of e-GP…" : "Log customer out of e-GP"}
          aria-busy={signingOutCustomer}
          disabled={signingOutCustomer}
          className="shrink-0 rounded-lg border border-primary-200 hover:bg-primary-100 px-2 py-1.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </div> : <p>Use Login on a saved customer in Customers to start.</p>}
      {error && <p role="alert" className="mt-1 text-red-600">{error}</p>}
    </div>
  );
}
