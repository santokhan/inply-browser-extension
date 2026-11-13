// Serialized by executeScript during connection recovery. Keep all page logic inside.
export function tenderPageAction(action, tenderId, expectedOrigin) {
  /**
   * Opens the "My Tenders" page by clicking its link.
   * Called by the content-script message router.
   */
  function openTenders(expectedOrigin) {
    if (window.location.origin !== expectedOrigin) {
      return { ok: false, message: 'The tender page left eProcure.' };
    }
    const link =
      document.querySelector('a#openMyTenders') ||
      document.querySelector('a[href="/tenderer/MyTenders.jsp"]') ||
      [...document.querySelectorAll('a')].find(a => a.textContent.trim().replace(/\s+/g, ' ') === 'My Tenders');

    if (!link) {
      return { ok: false, message: 'My Tenders link not found on this page.' };
    }

    link.click();
    return { ok: true };
  }

  /**
   * Fills the Tender ID field for a given tender and clicks Search.
   * Called by the content-script message router.
   * @param {number|string} tenderId - the tender ID to search for
   */
  function searchTender(tenderId, expectedOrigin) {
    if (window.location.origin !== expectedOrigin) {
      return { ok: false, message: 'The tender page left eProcure.' };
    }
    const id = String(tenderId).trim();
    if (!/^\d+$/.test(id)) {
      throw new TypeError('tenderId must be numeric');
    }

    /**
     * Finds the Search submit button.
     * @returns {HTMLInputElement|null}
     */
    function findSearchButton() {
      return document.querySelector('table tbody tr td input[type="submit"]#btnSearch');
    }

    /**
     * Finds the Tender ID input field inside a table cell.
     * @returns {HTMLInputElement|null}
     */
    function findTenderIdField() {
      // Use an attribute selector because the page has duplicate tenderId IDs.
      return document.querySelector('table tbody tr td input[id="tenderId"]');
    }

    const field = findTenderIdField();
    const button = findSearchButton();
    if (!field || !button || button.disabled) {
      return { ok: false, retryable: true, message: 'The My Tenders search controls are unavailable. Check the eProcure tab and try again.' };
    }

    field.value = id;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    button.click();

    return {
      ok: true,
      message: `Search started for tender ${id}.`,
    };
  }

  if (action === "install") {
    if (window.InplyTenderListenerInstalled) return;
    window.InplyTenderListenerInstalled = true;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!["openTenders", "searchTender"].includes(message?.action)) return false;
      try {
        sendResponse(tenderPageAction(message.action, message.tenderId, message.expectedOrigin));
      } catch (error) {
        sendResponse({ ok: false, message: error.message });
      }
      return false;
    });
    return;
  }
  if (action === "openTenders") return openTenders(expectedOrigin);
  if (action === "searchTender") return searchTender(tenderId, expectedOrigin);
}

export function openTenders(expectedOrigin) {
  return tenderPageAction("openTenders", undefined, expectedOrigin);
}

export function searchTender(tenderId, expectedOrigin) {
  return tenderPageAction("searchTender", tenderId, expectedOrigin);
}
