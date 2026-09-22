import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import OpenEncryptLink from "./actions/OpenEncryptLink";
import DecryptEncryptSave from "./actions/DecryptEncryptSave";
import SignEncryptSave from "./actions/SignEncryptSave";

const ENCRYPT_PASSWORD_KEY = "encryptPassword";
const PAGE_SETTLE_DELAY = 500;

export default function Encrypt() {
  const [password, setPassword] = useState("");
  const [pageReady, setPageReady] = useState(false);
  const [isEncryptAction, setIsEncryptAction] = useState(false);

  useEffect(() => {
    let settleTimeout;
    let activeTabId;

    const clearReadyState = () => {
      window.clearTimeout(settleTimeout);
      setPageReady(false);
    };

    const checkActiveTab = async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      activeTabId = tab?.id;
      setIsEncryptAction(new URL(tab?.url || "", window.location.href).searchParams.get("action") === "Encrypt");

      clearReadyState();
      if (tab?.status !== "complete") return;

      settleTimeout = window.setTimeout(() => {
        setPageReady(true);
      }, PAGE_SETTLE_DELAY);
    };

    const handleTabUpdated = (tabId, changeInfo) => {
      if (tabId !== activeTabId) return;
      if (changeInfo.status === "loading") clearReadyState();
      if (changeInfo.status === "complete") checkActiveTab();
    };

    checkActiveTab();
    chrome.tabs.onActivated.addListener(checkActiveTab);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      window.clearTimeout(settleTimeout);
      chrome.tabs.onActivated.removeListener(checkActiveTab);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, []);

  useEffect(() => {
    chrome.storage.local.get(ENCRYPT_PASSWORD_KEY).then((result) => {
      setPassword(result?.[ENCRYPT_PASSWORD_KEY] || "");
    });
  }, []);
  async function handleSavePassword(event) {
    event.preventDefault();
    if (!password) {
      toast.info("Enter a password first.");
      return;
    }

    try {
      await chrome.storage.local.set({ [ENCRYPT_PASSWORD_KEY]: password });
    } catch (error) {
      console.error(error);
      toast.info("Could not save the password.");
    }
  }

  return (
    <div className="px-3 py-2 space-y-3">
      <form onSubmit={handleSavePassword} className="p-3 bg-white rounded-xl border border-gray-200 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Encrypt / Decrypt</h2>
          <p className="text-xs text-gray-500 mt-1">
            Save your password locally and reuse for encrypt & decrypt.
          </p>
        </div>

        <div className="flex items-center gap-4">

          <input
            className="default"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />


          <button type="submit" className="default" >
            Save
          </button>
        </div>
      </form>

      {/* {password &&
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Fill Actions</h3>
          <SignEncryptSave pageReady={pageReady} />
        </section>
      } */}
      {password &&
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Encrypt Actions</h3>
          {isEncryptAction ? (
            <DecryptEncryptSave pageReady={pageReady} />
          ) : (
            <OpenEncryptLink className="w-full" />
          )}
        </section>
      }
    </div>
  );
}
