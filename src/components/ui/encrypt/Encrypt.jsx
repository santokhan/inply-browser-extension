import { useEffect, useState } from "react";
import { getActiveTabSafe } from "../../../utils/chrome";
import DecryptWithPassword from "./actions/Decrypt";
import EncryptConfirmOk from "./actions/Encrypt";
import SignEncryptSave from "./actions/Sign";
import SaveEcrypted from "./actions/SaveEncrypted";

const ENCRYPT_PASSWORD_KEY = "encryptPassword";
function openEncryptLinkInPage() {
  const anchor = [...document.querySelectorAll("a")].find((candidate) =>
    candidate instanceof HTMLAnchorElement && candidate.href && candidate.textContent.trim() === "Encrypt"
  );

  if (!anchor) {
    return { ok: false, message: "No Encrypt link was found on this page." };
  }

  anchor.click();
  return { ok: true };
}

async function openEncryptLink(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: openEncryptLinkInPage,
  });
  return result?.result;
}
export default function Encrypt() {
  const [password, setPassword] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    chrome.storage.local.get(ENCRYPT_PASSWORD_KEY).then((result) => {
      setPassword(result?.[ENCRYPT_PASSWORD_KEY] || "");
    });
  }, []);

  async function handleEncrypt(event) {
    event.preventDefault();
    if (!password) {
      setMessage("Enter a password first.");
      return;
    }

    try {
      await chrome.storage.local.set({ [ENCRYPT_PASSWORD_KEY]: password });
    } catch (error) {
      console.error(error);
      setMessage("Could not save the password.");
      return;
    }

    const tab = await getActiveTabSafe();
    if (!tab?.id) {
      setMessage("Password saved. Open the tender preparation page before using Encrypt.");
      return;
    }

    try {
      setEncrypting(true);
      const result = await openEncryptLink(tab.id);
      setMessage(result?.ok ? "Password saved. Encrypt link opened." : (result?.message || "Password saved. No Encrypt link was found."));
    } catch (error) {
      console.error(error);
      setMessage("Password saved, but this page cannot be controlled by the extension.");
    } finally {
      setEncrypting(false);
    }
  }

  return (
    <div className="px-3 py-2">
      <form onSubmit={handleEncrypt} className="p-3 bg-white rounded-xl border border-gray-200 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Encrypt / Decrypt</h2>
          <p className="text-xs text-gray-500 mt-1">
            Save your password locally and reuse for encrypt & decrypt.
          </p>
        </div>
        <input
          className="default"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete="current-password"
        />

        {/* Save the password, then open the Encrypt link on the active page. */}
        <button type="submit" className="default w-full" disabled={encrypting}>
          {encrypting ? "Opening..." : "Save & Open Encrypt Link"}
        </button>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {/* 0. Sign encrypt and save button */}
            <SignEncryptSave setMessage={setMessage} />
            <EncryptConfirmOk setMessage={setMessage} />
            <SaveEcrypted setMessage={setMessage} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {/* 1. Decrypt with password button */}
          <DecryptWithPassword setMessage={setMessage} />
          {/* 2. Encrypt with confirm button */}
          <EncryptConfirmOk setMessage={setMessage} />
        </div>
        {message && <p className="text-xs text-gray-600">{message}</p>}
      </form>
    </div>
  );
}