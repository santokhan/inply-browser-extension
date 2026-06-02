import { useAuth } from "../../hooks/useAuth";

export function Protected({ children = null, fallback = null }) {
  const { isAuthenticated, loading } = useAuth();

  // Optional: loading state while reading chrome.storage
  if (loading) {
    return <div className="p-3 text-sm">Loading...</div>;
  }

  // Not logged in → block access
  if (!isAuthenticated) {
    return fallback;
  }

  // Allowed
  return children;
}
