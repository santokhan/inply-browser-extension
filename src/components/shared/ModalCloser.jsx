import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { installModalCloser } from "../../utils/modalCloser";

export default function ModalCloser() {
  const [testing, setTesting] = useState(false);

  async function testCloser() {
    setTesting(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.id == null || !tab.url?.startsWith("https://www.eprocure.gov.bd/")) {
        toast.info("Open an eProcure tab to test the modal closer.");
        return;
      }
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id }, func: installModalCloser,
      });
      const result = injection?.result;
      if (result?.closed) toast.success(result.message);
      else toast.info(result?.message || "Could not check the modal. Reload the webpage and try again.");
    } catch {
      toast.error("Could not access the eProcure page. Wait for it to load and try again.");
    } finally {
      setTesting(false);
    }
  }
  useEffect(() => {
    function install(tab) {
      if (tab?.id == null || !tab.url?.startsWith("https://www.eprocure.gov.bd/") || tab.status === "loading") return;
      void chrome.scripting.executeScript({
        target: { tabId: tab.id }, func: installModalCloser,
      }).catch(() => {});
    }
    function refresh() {
      void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => install(tab)).catch(() => {});
    }
    function onUpdated(_tabId, change, tab) {
      if (change.status === "complete") install(tab);
    }
    refresh();
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);
  return (
    <div className="flex justify-end px-3 py-1">
      <button type="button" className="secondary text-xs" onClick={testCloser} disabled={testing}>
        {testing ? "Testing..." : "Test Modal Closer"}
      </button>
    </div>
  );
}
