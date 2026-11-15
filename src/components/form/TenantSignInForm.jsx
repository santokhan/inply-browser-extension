import AuthLayout from "./AuthLayout";
import { EmailField, PasswordField } from "./AuthFields";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { signInTenantWithEmail } from "../../firebase/methods";
import { useTenantAuth } from "../../hooks/useTenantAuth";

export default function TenantSignInForm({ switchTo = () => { } }) {
  const [email, setEmail] = useState(import.meta.env.VITE_EMAIL || "");
  const [password, setPassword] = useState(import.meta.env.VITE_PASSWORD || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { tenantAuthError } = useTenantAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      await signInTenantWithEmail(email, password);

      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout mode="signin">
      <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
        <EmailField value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
        <div className="auth-forgot"><button type="button" className="auth-link" onClick={() => switchTo("forgot")} disabled={loading}>Forgot password?</button></div>
        {(error || tenantAuthError) && <p className="auth-message auth-error" role="alert">{error || tenantAuthError}</p>}
        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
          {loading ? "Signing in..." : "Sign in"}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>
      <p className="auth-switch">New to Tenddoo? <button type="button" onClick={() => switchTo("signup")} className="auth-link" disabled={loading}>Create an account</button></p>
      <p className="auth-account-note">Use your Tenddoo account to manage your saved eProcure customers.</p>
    </AuthLayout>
  );
}
