import { useAuth } from "../../hooks/useAuth";

export function Protected({ children = null, fallback = null }) {
  const { user, loading } = useAuth();

  // Optional: loading state while reading chrome.storage
  if (loading) {
    return <div className="p-3 text-sm">Loading...</div>;
  }

  // Not logged in → block access
  if (!user) {
    return fallback;
  }

  // Allowed
  return children;
}
