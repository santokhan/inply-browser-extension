import { useTenantAuth } from "../../hooks/useTenantAuth";

export function TenantProtected({ children = null, fallback = null }) {
  const { tenant, tenantAuthLoading } = useTenantAuth();

  // Optional: loading state while reading chrome.storage
  if (tenantAuthLoading) {
    return <div className="p-3 text-sm">Loading...</div>;
  }

  // Not logged in → block access
  if (!tenant) {
    return fallback;
  }

  // Allowed
  return children;
}
