const ENCRYPT_LINK_BATCH = "duplicateAndClickEncryptLinks";
const DECRYPT_ALL_ENCRYPT_TABS = "decryptAllEncryptTabs";
const GET_ENCRYPT_TAB_COUNT = "getEncryptTabCount";
const ENCRYPT_TAB_IDS_KEY = "encryptTabIds";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getTrackedTabIds() {
  const stored = await chrome.storage.local.get(ENCRYPT_TAB_IDS_KEY);
  const tabIds = Array.isArray(stored?.[ENCRYPT_TAB_IDS_KEY]) ? stored[ENCRYPT_TAB_IDS_KEY] : [];
  const existingTabIds = [];

  for (const tabId of tabIds) {
    try {
      await chrome.tabs.get(tabId);
      existingTabIds.push(tabId);
    } catch {
      // The tab was closed.
    }
  }

  if (existingTabIds.length !== tabIds.length) {
    await chrome.storage.local.set({ [ENCRYPT_TAB_IDS_KEY]: existingTabIds });
  }

  return existingTabIds;
}

async function getDecryptableTabIds() {
  return getTrackedTabIds();
}

async function saveTrackedTabIds(tabIds) {
  await chrome.storage.local.set({ [ENCRYPT_TAB_IDS_KEY]: [...new Set(tabIds)] });
}

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

async function decryptAndEncryptInTab(tabId, password) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [password],
    func: async (savedPassword) => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const visible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      };
      const label = (element) => (element?.innerText || element?.value || element?.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ").trim().toLowerCase();
      const buttons = () => [...document.querySelectorAll("#decrypt, #encrypt, button, input[type=button], input[type=submit], [role=button]")];
      const find = (labels) => buttons().find((element) => labels.includes(label(element)) && !element.disabled && visible(element));
      const setValue = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(input, value);
        else input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const decryptButton = find(["decrypt"]);
      if (decryptButton) {
        decryptButton.scrollIntoView({ block: "center", behavior: "smooth" });
        decryptButton.click();
      }

      let passwordInput;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        passwordInput = [...document.querySelectorAll("#myPanelDiv input#password, #myPanelDiv input[name=password], input[type=password]")]
          .find(visible);
        if (passwordInput) break;
        await wait(250);
      }
      if (!passwordInput) return { ok: false, message: "The password dialog was not found." };

      setValue(passwordInput, savedPassword);
      const verifyButton = find(["verify password"]);
      if (!verifyButton) return { ok: false, message: "The Verify Password button was not ready." };
      verifyButton.click();

      for (let attempt = 0; attempt < 40; attempt += 1) {
        const encryptButton = find(["encrypt and save", "encrypt"]);
        if (encryptButton) {
          encryptButton.scrollIntoView({ block: "center", behavior: "smooth" });
          encryptButton.click();
          for (let confirmationAttempt = 0; confirmationAttempt < 40; confirmationAttempt += 1) {
            const okButton = find(["ok"]);
            if (okButton) {
              okButton.click();
              return { ok: true, count: 1 };
            }
            await wait(250);
          }
          return { ok: true, count: 1 };
        }
        await wait(250);
      }

      return { ok: true, count: 1 };
    },
  });

  return result?.result;
}

async function duplicateAndClickEncryptLinks(sourceTabId) {
  const count = await countEncryptLinks(sourceTabId);
  if (!count) return [];

  const tabIds = [];
  await saveTrackedTabIds(tabIds);
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
          await saveTrackedTabIds(tabIds);
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

async function decryptAllEncryptTabs() {
  const tabIds = await getDecryptableTabIds();
  const stored = await chrome.storage.local.get("encryptPassword");
  const password = stored?.encryptPassword;
  if (!password) {
    return {
      ok: false,
      count: 0,
      total: tabIds.length,
      message: "Save your password before decrypting all tabs.",
    };
  }

  const results = await Promise.allSettled(
    tabIds.map((tabId) => decryptAndEncryptInTab(tabId, password))
  );
  const completed = results.filter((result) => result.status === "fulfilled" && result.value?.ok).length;
  const failureMessages = [...new Set(results
    .map((result) => result.status === "fulfilled" ? result.value?.message : result.reason?.message)
    .filter(Boolean))];

  return {
    ok: completed > 0,
    count: completed,
    total: tabIds.length,
    message: completed > 0
      ? `Decryption started in ${completed} of ${tabIds.length} tabs.`
      : failureMessages.length
        ? `Could not decrypt the open tabs: ${failureMessages.join("; ")}`
        : "No Decrypt buttons were found in the open tabs.",
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === GET_ENCRYPT_TAB_COUNT) {
    getDecryptableTabIds()
      .then((tabIds) => sendResponse({ ok: true, count: tabIds.length }))
      .catch(() => sendResponse({ ok: false, count: 0 }));
    return true;
  }

  if (message?.action === DECRYPT_ALL_ENCRYPT_TABS) {
    decryptAllEncryptTabs()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, count: 0, message: error?.message || "Could not decrypt the opened tabs." }));
    return true;
  }

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
