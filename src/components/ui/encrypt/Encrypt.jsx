import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import DecryptWithPassword from "./actions/Decrypt";
import EncryptConfirmOk from "./actions/Encrypt";
import Sign from "./actions/Sign";
import SaveEcrypted from "./actions/SaveEncrypted";
import OpenEncryptLink from "./actions/OpenEncryptLink";
import DecryptEncryptSave from "./actions/DecryptEncryptSave";
import SignEncryptSave from "./actions/SignEncryptSave";

const ENCRYPT_PASSWORD_KEY = "encryptPassword";
export default function Encrypt() {
  const [password, setPassword] = useState("");

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
      toast.info("Password saved.");
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

      {password &&
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Fill Actions</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Sign />
            <EncryptConfirmOk buttonLabel="Encrypt" />
            <SaveEcrypted />
          </div>
          <SignEncryptSave />
        </section>
      }
      {password &&
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Encrypt Actions</h3>
          <OpenEncryptLink className="w-full" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <DecryptWithPassword />
            <EncryptConfirmOk buttonLabel="Encrypt & Save" />
          </div>
          <DecryptEncryptSave />
        </section>
      }
    </div>
  );
}
