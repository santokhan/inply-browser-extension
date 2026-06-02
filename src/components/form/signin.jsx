import { useState } from "react";
import { sign_in_with_email } from "../../firebase/methods";
import { useAuth } from "../../hooks/useAuth";

export default function FormSignin({ switchTo = () => { } }) {
  const [email, setEmail] = useState(import.meta.env.VITE_EMAIL || "");
  const [password, setPassword] = useState(import.meta.env.VITE_PASSWORD || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { setToken, setUser } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const credential = await sign_in_with_email(email, password);
      const idToken = await credential.user.getIdToken();

      setToken(idToken);
      setUser(credential.user);

      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-3 space-y-3 my-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold">Sign In</h1>
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

        <div className="">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="default"
          />
          <div className="flex justify-end mt-1">
            <button type="button" className="text-blue-500" onClick={() => { switchTo("forgot") }}>
              Forgot Password
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          disabled={loading}
          className="w-full default"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="text-center">
        <p className="text-sm">
          Don't have an account?{" "}
          <button type="button" onClick={() => switchTo("signup")} className="text-blue-500">
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}