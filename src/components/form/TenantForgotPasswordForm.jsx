import AuthLayout from "./AuthLayout";
import { EmailField } from "./AuthFields";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { sendTenantPasswordReset } from "../../firebase/methods";

export default function TenantForgotPasswordForm({ switchTo = () => { } }) {
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await sendTenantPasswordReset(email);

      setSuccess("Password reset email sent");


    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout mode="forgot">
      <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
        <EmailField value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
        {success && <p className="auth-message auth-success" role="status">{success}. Check your inbox for the link.</p>}
        <button type="submit" disabled={loading} className="auth-submit">
          {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
          {loading ? "Sending reset link..." : "Send reset link"}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>
      <p className="auth-switch">Ready to return? <button type="button" onClick={() => switchTo("signin")} className="auth-link" disabled={loading}>Back to sign in</button></p>
    </AuthLayout>
  );
}
