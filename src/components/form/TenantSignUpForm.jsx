import AuthLayout from "./AuthLayout";
import { EmailField, PasswordField } from "./AuthFields";
import { ArrowRight, LoaderCircle } from "lucide-react";
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
    <AuthLayout mode="signup">
      <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
        <EmailField value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} creating />
        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
        {success && <p className="auth-message auth-success" role="status">{success}</p>}
        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
          {loading ? "Creating your account..." : "Create account"}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>
      <p className="auth-switch">Already have an account? <button type="button" onClick={() => switchTo("signin")} className="auth-link" disabled={loading}>Sign in</button></p>
      <p className="auth-account-note">Your Tenddoo account is separate from your eProcure login.</p>
    </AuthLayout>
  );
}
