import { useState } from "react";
import useCustomerSession from "../../../hooks/useCustomerSession";

export default function TestActions() {
  const { signOutCustomer } = useCustomerSession();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function testCustomerLogout() {
    setRunning(true);
    setMessage("");
    setError("");
    try {
      await signOutCustomer();
      setMessage("e-GP customer logout completed.");
    } catch (error) {
      setError(error.message || "e-GP customer logout failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-gray-500">Runs the real e-GP logout and clears the active customer after success.</p>
      <button type="button" className="default" onClick={testCustomerLogout} disabled={running}>
        {running ? "Logging out of e-GP…" : "Test customer logout"}
      </button>
      {message && <p role="status" className="text-xs text-green-700">{message}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
