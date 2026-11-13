import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { tenantAuth } from "../../../firebase/config";
import { refreshTenantWallet } from "../../../firebase/tenantWallet";
import { nextWalletGrantAt, WEEKLY_FREE_CREDITS } from "../../../utils/tenantWallet.js";

export default function TenantWallet({ tenantUid }) {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let pending = false;
    let timer;
    const refresh = async () => {
      if (!active || pending || tenantAuth.currentUser?.uid !== tenantUid) return;
      pending = true;
      setLoading(true);
      setError("");
      try {
        const result = await refreshTenantWallet(tenantUid);
        if (active) setWallet(result);
      } catch (cause) {
        console.error("Unable to load tenant wallet", cause);
        if (active) setError("Could not update your wallet. Check your connection and try again.");
      } finally {
        pending = false;
        if (active) {
          setLoading(false);
          clearTimeout(timer);
          timer = setTimeout(refresh, nextWalletGrantAt() - Date.now() + 1000);
        }
      }
    };
    const unsubscribe = onAuthStateChanged(tenantAuth, (user) => {
      if (user?.uid === tenantUid) {
        void refresh();
      } else {
        setWallet(null);
        setLoading(false);
        setError("Sign in to load your tenant wallet.");
      }
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [tenantUid, attempt]);

  return (
    <section aria-label="Tenant wallet" className="mx-3 my-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary-700">Wallet</h2>
        <span role="status" className="text-sm font-bold text-primary-700">
          {loading ? "Updating…" : wallet ? `${wallet.balance.toLocaleString()} credits` : "Unavailable"}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        {WEEKLY_FREE_CREDITS} free credits every Monday (UTC). Unused credits carry over.
      </p>
      {error && (
        <div role="alert" className="mt-1 text-xs text-red-700">
          {error}{" "}
          <button type="button" disabled={loading} onClick={() => setAttempt((value) => value + 1)} className="underline disabled:opacity-50">Retry</button>
        </div>
      )}
    </section>
  );
}
