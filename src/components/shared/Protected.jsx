import { useAuth } from "../../hooks/useAuth";
import { useState } from "react";
import { normalizeJwtToken } from "../../utils/token";

export default function TokenLoginForm() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token.trim()) {
      setError("Token is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // simple fake decode (optional later replace with API verify)
      const user = {
        name: "Local User",
        role: "user",
      };

      await login({
        token: normalizeJwtToken(token),
        user,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-80 p-3 space-y-3 my-4">

      <div className="text-center">
        <h1 className="text-lg font-semibold text-gray-800">
          Sign In
        </h1>
        <p className="text-xs text-gray-500">
          Enter your access token
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-2"
      >
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter token..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200"
        />

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <button
          disabled={loading}
          className="w-full py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export function Protected({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Optional: loading state while reading chrome.storage
  if (loading) {
    return <div className="p-3 text-sm">Loading...</div>;
  }

  // Not logged in → block access
  if (!isAuthenticated) {
    return (
      <TokenLoginForm />
    );
  }

  // Allowed
  return children;
}
