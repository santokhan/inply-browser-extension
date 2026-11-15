import { runFillSignEncryptSave } from "../../../../utils/fillSignEncryptSave.js";
import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";
import PageActionButton from "./PageActionButton";

export function FillSignEncryptSave({ pageReady = true, beforeRun, className = "default w-full", disabled = false, onRunningChange }) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const hoverCooldown = useRef(false);

  async function handleRunAll({ applyOnly = false } = {}) {
    if (hoverCooldown.current || disabled) return;

    hoverCooldown.current = true;
    try {
      setRunning(true);
      onRunningChange?.(true);
      const tab = await getActiveTabSafe();
      if (!tab?.id) {
        toast.info("Open the tender preparation page before using Sign, Encrypt & Save.");
        return;
      }
      const result = await runFillSignEncryptSave(tab.id, { beforeRun, applyOnly, setStatus });
      if (!result.ok) toast.info(result.message);
    } catch (error) {
      console.error(error);
      toast.info("This page cannot be controlled by the extension. Reload the page and try again.");
    } finally {
      setRunning(false);
      onRunningChange?.(false);
      setStatus("");
      window.setTimeout(() => {
        hoverCooldown.current = false;
      }, 1500);
    }
  }

  return (
    <>
      <PageActionButton pageReady={pageReady} className={className} onClick={handleRunAll} disabled={running || disabled} title={beforeRun ? "This will fill the form, sign and verify, encrypt, and save the page." : undefined}>
        {/* Total 3 actions */}
        {running ? status || "Running..." : pageReady ? "Fill Sign Encrypt Save" : "Waiting for page..."}
      </PageActionButton>
      {import.meta.env.DEV && beforeRun && (
        <PageActionButton pageReady={pageReady} className={className} onClick={() => handleRunAll({ applyOnly: true })} disabled={running || disabled} title="Apply values to the form.">
          Apply
        </PageActionButton>
      )}
    </>
  );
}
