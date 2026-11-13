import { useEffect, useId, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { refreshTenantWallet, subscribeTenantWallet } from "../../../firebase/tenantWallet";
import { nextWalletGrantAt, walletWeek, WEEKLY_FREE_CREDITS } from "../../../utils/tenantWallet.js";

export default function TenantWallet({ tenantUid, tenantName, tenantInitial, tenantEmail, onSignOut, signingOut }) {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownId = useId();

  useEffect(() => subscribeTenantWallet(tenantUid, setWallet, (cause) => {
    console.error("Unable to read tenant wallet", cause);
    setError(cause.code === "permission-denied"
      ? "Wallet access was denied. The tenantWallets Firestore rules need to be published."
      : "Could not load your wallet. Check your connection and retry.");
  }), [tenantUid, attempt]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    let active = true;
    let pending = false;
    let timer;
    const refresh = async () => {
      if (!active || pending) return;
      pending = true;
      setLoading(true);
      setError("");
      try {
        const result = await refreshTenantWallet(tenantUid);
        if (active) setWallet(result);
      } catch (cause) {
        console.error("Unable to load tenant wallet", cause);
        if (active) setError(cause.code === "permission-denied"
          ? "Wallet access was denied. The tenantWallets Firestore rules need to be published."
          : "Could not update your wallet. Check your connection and try again.");
      } finally {
        pending = false;
        if (active) {
          setLoading(false);
          clearTimeout(timer);
          timer = setTimeout(refresh, nextWalletGrantAt() - Date.now() + 1000);
        }
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tenantUid, attempt]);

  const grantBalance = wallet?.lastGrantWeek === walletWeek()
    ? (wallet.grantBalance ?? Math.min(wallet.balance ?? 0, WEEKLY_FREE_CREDITS))
    : 0;
  const balance = wallet?.purchasedBalance ?? 0;
  const totalCredits = grantBalance + balance;

  return (
    <div
      ref={dropdownRef}
      className="relative"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Tenant profile for ${tenantName}`}
        aria-expanded={open}
        aria-controls={dropdownId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 p-1 pr-3 text-primary-700 hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold">
          {tenantInitial}
        </span>
        <span role="status" aria-label="Credit balance" aria-busy={loading} className="max-w-32 truncate whitespace-nowrap text-xs font-semibold">
          {totalCredits.toLocaleString()}
        </span>
      </button>
      {open && (
        <div id={dropdownId} className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-lg">
          <p className="break-words font-semibold text-gray-900">{tenantName}</p>
          {tenantEmail && tenantEmail !== tenantName && (
            <p className="mt-0.5 break-words text-xs text-gray-500">{tenantEmail}</p>
          )}
          <div className="my-3 border-y border-gray-100 py-3">
              <dl className="mt-2 space-y-1 text-xs text-gray-700">
                <div className="flex justify-between gap-2">
                  <dt>Main credit balance</dt>
                  <dd>{balance.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Weekly free credits</dt>
                  <dd>{grantBalance.toLocaleString()} / {WEEKLY_FREE_CREDITS}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-gray-100 pt-2 font-semibold">
                  <dt>Total credits</dt>
                  <dd>{totalCredits.toLocaleString()}</dd>
                </div>
              </dl>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              Free credits reset to {WEEKLY_FREE_CREDITS} every Monday at 00:00 UTC.
            </p>
            {error && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {error}{" "}
                <button type="button" disabled={loading} onClick={() => setAttempt((value) => value + 1)} className="underline disabled:opacity-50">
                  Retry
                </button>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
