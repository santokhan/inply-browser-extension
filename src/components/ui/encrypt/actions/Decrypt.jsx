import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";

async function decryptAnchorsInPage() {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const button = [...document.querySelectorAll('#encrypt, input[name="encrypt"], button, input[type="button"], input[type="submit"], [role="button"]')].find((element) => {
    const label = (element.innerText || element.value || "").trim().toLowerCase();
    return label === "decrypt" && !element.disabled && isVisible(element);
  });

  if (!button) {
    return { ok: false, count: 0, message: "No decrypted links were found on this page." };
  }

  await chrome.storage.local.set({
    pendingEncryptAndSave: { createdAt: Date.now() },
  });
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
  const password = (await chrome.storage.local.get("encryptPassword"))?.encryptPassword;
  if (password) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const input = document.querySelector("#myPanelDiv input#password, #myPanelDiv input[name=\"password\"]");
      if (input && isVisible(input)) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(input, password); else input.value = password;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        const verifyButton = [...document.querySelectorAll("#myPanelDiv button, #myPanelDiv input[type=\"button\"], #myPanelDiv input[type=\"submit\"]")].find((element) => {
          const label = (element.innerText || element.value || "").trim().toLowerCase();
          return label === "verify password" && !element.disabled && isVisible(element);
        });
        if (verifyButton) {
          await chrome.storage.local.set({ pendingEncryptAndSave: { createdAt: Date.now() } });
          verifyButton.click();
          break;
        }
      }
      await wait(250);
    }
  }
  return { ok: true, count: 1 };
}

async function sendDecryptMessage(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: "decryptAnchors" });
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) {
      throw error;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: decryptAnchorsInPage,
    });
    return result?.result;
  }
}

export default function DecryptWithPassword() {
  const [pending, setPending] = useState(false);
  const hoverCooldown = useRef(false);

  return (
    <button type="button" className="hover-action grow" onMouseEnter={async () => {
       if (hoverCooldown.current) return;
      // Click the decrypt button here manually to text the encrypt page
      const tab = await getActiveTabSafe();
      if (!tab?.id) {
        toast.info("Open the tender preparation page before using Decrypt.");
        return;
      }
      hoverCooldown.current = true;
      try {
        setPending(true);
        const result = await sendDecryptMessage(tab.id);
        console.log(result)
        console.log("[Decrypt] Response from page:", result);
        const count = Number.isFinite(result?.count) ? result.count : 0;
        toast.info(result?.ok ? ("Clicked " + count + " decrypted link(s).") : (result?.message || "No decrypted links were found."));
      } catch (error) {
        console.error(error);
        const errorMessage = String(error?.message || error);
        if (errorMessage.includes("Receiving end does not exist") || errorMessage.includes("Frame with ID 0 was removed")) {
          toast.info("Reload the target page, then try Decrypt again.");
        } else {
          console.error(error);
          toast.info("This page cannot be controlled by the extension.");
        }
      } finally {
        setPending(false);

        window.setTimeout(() => {
          hoverCooldown.current = false;
        }, 1500);
      }
    }}>
      {pending ? "Decrypting..." : "Decrypt"}
    </button>
  );
}