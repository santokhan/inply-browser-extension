import { useState } from "react";
import { forgot_password } from "../../firebase/methods";

export default function FormForgotPassword({ switchTo = () => { } }) {
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

      switchTo("signin");
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-3 space-y-3 my-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold">Forgot Password</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-3"
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

      <div className="text-center">
        <p className="text-sm">
          Remember your password?{" "}
          <button type="button" onClick={() => switchTo("signin")} className="text-blue-500">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}