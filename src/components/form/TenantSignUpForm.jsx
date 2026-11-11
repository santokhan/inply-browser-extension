import { useState } from "react";
import { signUpTenantWithEmail } from "../../firebase/methods";
import { useTenantAuth } from "../../hooks/useTenantAuth";

export default function TenantSignUpForm({ switchTo = () => { } }) {
  const [email, setEmail] = useState(import.meta.env.VITE_EMAIL || "");
  const [password, setPassword] = useState(import.meta.env.VITE_PASSWORD || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { setTenantToken, setTenant } = useTenantAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const credential = await signUpTenantWithEmail(email, password);

      localStorage.setItem("refreshToken", credential.user.refreshToken);

      const accessToken = await credential.user.getIdToken();
      await chrome.storage.local.set({
        auth_token: accessToken,
        auth_user: credential.user.toJSON(),
      });
      setTenantToken(accessToken);
      setTenant(credential.user.toJSON());

      setSuccess("Tenant account created successfully");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-3 space-y-3 my-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold">Create tenant account</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-2"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tenant email"
          className="default"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Tenant password"
          className="default"
        />

        {error && <p className="text-xs text-red-500">{error}</p>}
        {success && <p className="text-xs text-green-600">{success}</p>}

        <button
          disabled={loading}
          className="default w-full"
        >
          {loading ? "Creating..." : "Create tenant account"}
        </button>
      </form>

      <div className="text-center">
        <p className="text-sm">
          Already have an account?{" "}
          <button type="button" onClick={() => switchTo("signin")} className="text-blue-500">
            Tenant sign in
          </button>
        </p>
      </div>
    </div>
  );
}
