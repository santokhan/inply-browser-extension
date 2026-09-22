import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function DecryptAllTabs({ hasPassword = true, onTabCountChange }) {
  const [tabCount, setTabCount] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: "getEncryptTabCount" })
      .then((result) => {
        const count = result?.count || 0;
        setTabCount(count);
        onTabCountChange?.(count);
      })
      .catch((error) => console.error("[Decrypt] Could not get opened tabs:", error));
  }, [onTabCountChange]);

  if (!tabCount) return null;

  async function handleDecryptAll() {
    if (pending) return;
    if (!hasPassword) {
      toast.info("Save your password first, then use Decrypt all tabs.");
      return;
    }
    try {
      setPending(true);
      const result = await chrome.runtime.sendMessage({ action: "decryptAllEncryptTabs" });
      toast.info(result?.message || "Could not decrypt the open tabs.");
    } catch (error) {
      console.error(error);
      toast.info(`Decrypt all failed: ${error?.message || "Unknown extension error"}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" className="default w-full" onClick={handleDecryptAll} disabled={pending}>
      {pending ? "Decrypting all..." : tabCount ? `Decrypt all tabs (${tabCount})` : "Decrypt all tabs"}
    </button>
  );
}
