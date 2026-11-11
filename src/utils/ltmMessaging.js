import { installPageParser } from "./pageParser.js";

const pendingConnections = new Map();

function needsConnection(result) {
  return result?.message?.includes("No content-script handler is registered for action");
}

// Serialized into the isolated content-script world. Avoid running content.js,
// which also starts automatic signing/encryption flows when it loads.
function installLtmRouter(resetRouter) {
  if (window.InplyContentRouter && !resetRouter) return;
  const handlers = new Map();
  window.InplyContentRouter = {
    register(actions, handler) {
      for (const action of Array.isArray(actions) ? actions : [actions]) handlers.set(action, handler);
    },
  };
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = handlers.get(message.action);
    if (!handler) {
      sendResponse({ ok: false, message: `No content-script handler is registered for action "${message.action}".` });
      return false;
    }
    Promise.resolve().then(() => handler(message, sender)).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, message: error.message || "The webpage action failed." });
    });
    return true;
  });
}

async function connect(tabId, resetRouter) {
  await chrome.scripting.executeScript({ target: { tabId }, func: installLtmRouter, args: [resetRouter] });
  await chrome.scripting.executeScript({ target: { tabId }, func: installPageParser });
}

export async function sendLtmMessage(tabId, message) {
  let resetRouter = false;
  try {
    const result = await chrome.tabs.sendMessage(tabId, message);
    if (!needsConnection(result)) return result;
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) throw error;
    resetRouter = true;
  }

  let pending = pendingConnections.get(tabId);
  if (!pending) {
    pending = connect(tabId, resetRouter).finally(() => pendingConnections.delete(tabId));
    pendingConnections.set(tabId, pending);
  }
  await pending;
  const result = await chrome.tabs.sendMessage(tabId, message);
  if (!needsConnection(result)) return result;
  throw new Error("LTM editing could not connect. Reload the webpage and try again.");
}
