import { useState } from "react";
import { reset_password } from "../../firebase/auth";

export default function FormResetPassword() {
  const [oobCode, setOobCode] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await reset_password(oobCode, password);

      setSuccess("Password updated successfully");
      setPassword("");
    } catch (err) {
      setError(err.message || "Reset failed");
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
        value={oobCode}
        onChange={(e) => setOobCode(e.target.value)}
        placeholder="Reset Code"
        className="default"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New Password"
        className="default"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}

      <button
        disabled={loading}
        className="w-full py-2 text-white bg-indigo-600 rounded-lg"
      >
        {loading ? "Updating..." : "Reset Password"}
      </button>
    </form>
  );
}