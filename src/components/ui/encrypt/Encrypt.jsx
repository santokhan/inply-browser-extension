import { useEffect, useState } from "react";
import { getActiveTabSafe } from "../../../utils/chrome";

const ENCRYPT_PASSWORD_KEY = "encryptPassword";
async function encryptAnchorsInPage(password) {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const fillPasswordFields = () => {
    const fields = [...document.querySelectorAll('input[type="password"], input[name*="password" i]')];
    fields.forEach((field) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(field, password);
      else field.value = password;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  let count = 0;
  while (true) {
    const anchor = [...document.querySelectorAll("a")].find((candidate) =>
      candidate instanceof HTMLAnchorElement && candidate.href && candidate.innerHTML.trim() === "Encrypt"
    );
    if (!anchor) break;
    fillPasswordFields();
    anchor.scrollIntoView({ block: "center", behavior: "smooth" });
    anchor.click();
    count += 1;
    await wait(750);
  }

  return count
    ? { ok: true, count }
    : { ok: false, count: 0, message: "No encrypted links were found on this page." };
}

async function sendEncryptMessage(tabId, password) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      action: "encryptAnchors",
      password,
    });
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) {
      throw error;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: encryptAnchorsInPage,
      args: [password],
    });
    return result?.result;
  }
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
      setMessage("Password saved.");
      const result = await sendEncryptMessage(tab.id, password);
      console.log("[Encrypt] Response from page:", result);
      const count = Number.isFinite(result?.count) ? result.count : 0;
      setMessage(result?.ok ? ("Password saved. Clicked " + count + " encrypted link(s).") : (result?.message || "Password saved. No encrypted links were found."));
    } catch (error) {
      const errorMessage = String(error?.message || error);
      if (errorMessage.includes("Receiving end does not exist")) {
        setMessage("Password saved. Reload the target page, then try Encrypt again.");
      } else {
        console.error(error);
        setMessage("Password saved, but this page cannot be controlled by the extension.");
      }
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
        <button type="submit" className="default w-full" disabled={encrypting}>
          {encrypting ? "Encrypting..." : "Save password and Encrypt"}
        </button>
        {message && <p className="text-xs text-gray-600">{message}</p>}
      </form>
    </div>
  );
}