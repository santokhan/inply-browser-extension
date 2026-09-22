const ENCRYPT_LINK_BATCH = "duplicateAndClickEncryptLinks";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function clickEncryptLinkAtIndex(index) {
  const anchors = [...document.querySelectorAll("a")].filter((anchor) =>
    anchor instanceof HTMLAnchorElement &&
    anchor.href &&
    anchor.textContent.trim() === "Encrypt"
  );
  const anchor = anchors[index];

  if (!anchor) return { ok: false };

  anchor.target = "_self";
  anchor.click();
  return { ok: true };
}

async function countEncryptLinks(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => [...document.querySelectorAll("a")].filter((anchor) =>
      anchor instanceof HTMLAnchorElement &&
      anchor.href &&
      anchor.textContent.trim() === "Encrypt"
    ).length,
  });
  return result?.result || 0;
}

async function duplicateAndClickEncryptLinks(sourceTabId) {
  const count = await countEncryptLinks(sourceTabId);
  if (!count) return [];

  const tabIds = [];
  for (let index = 0; index < count; index += 1) {
    const duplicatedTab = await chrome.tabs.duplicate(sourceTabId);
    if (!duplicatedTab?.id) continue;

    await chrome.tabs.update(duplicatedTab.id, { active: false });

    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: duplicatedTab.id },
          func: clickEncryptLinkAtIndex,
          args: [index],
        });
        if (result?.result?.ok) {
          tabIds.push(duplicatedTab.id);
          break;
        }
      } catch {
        // Wait for the duplicated tab to finish loading.
      }
      await wait(250);
    }
  }

  return tabIds;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== ENCRYPT_LINK_BATCH) return false;

  if (!Number.isInteger(message.tabId)) {
    sendResponse({ ok: false, count: 0, message: "The active tab could not be identified." });
    return false;
  }

  duplicateAndClickEncryptLinks(message.tabId)
    .then((tabIds) => sendResponse({ ok: true, count: tabIds.length, tabIds }))
    .catch((error) => {
      console.error("[Encrypt] Could not open Encrypt tabs:", error);
      sendResponse({
        ok: false,
        count: 0,
        message: error?.message || "Could not open the Encrypt tabs.",
      });
    });

  return true;
});
