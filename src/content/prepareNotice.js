// Feature-specific page actions for the Prepare Notice workflow.
export function prepareNoticePageAction(action, expectedOrigin) {
  function openAllTenders() {
    if (window.location.origin !== expectedOrigin) {
      return { ok: false, message: "The active page is not eProcure." };
    }

    const link = document.querySelector('a[href="/resources/common/AllTenders.jsp?h=f"]');
    if (!link) {
      return { ok: false, message: "All Tenders link not found on this page." };
    }

    link.click();
    return { ok: true };
  }

  if (action === "install") {
    if (window.InplyPrepareNoticeListenerInstalled) return;
    window.InplyPrepareNoticeListenerInstalled = true;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.action !== "prepareNotice") return false;
      try {
        sendResponse(prepareNoticePageAction(message.task, message.expectedOrigin));
      } catch (error) {
        sendResponse({ ok: false, message: error.message || "Prepare Notice failed." });
      }
      return false;
    });
    return;
  }

  if (action === "openAllTenders") return openAllTenders();
  return { ok: false, message: `Unknown Prepare Notice action: ${action}.` };
}
