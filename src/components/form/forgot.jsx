import { useState } from "react";
import { forgot_password } from "../../firebase/auth";

export default function FormForgotPassword() {
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

      await forgot_password(email);

      setSuccess("Password reset email sent");
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-3 rounded-xl border shadow-sm space-y-2"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="default"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}

      <button
        disabled={loading}
        className="w-full py-2 text-white bg-indigo-600 rounded-lg"
      >
        {loading ? "Sending..." : "Send Reset Email"}
      </button>
    </form>
  );
}