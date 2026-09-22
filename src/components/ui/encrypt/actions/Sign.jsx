import { useRef, useState } from "react";
import { getActiveTabSafe } from "../../../../utils/chrome";
import { toast } from "react-toastify";

const ENCRYPT_PASSWORD_KEY = "encryptPassword";

async function signAndVerifyInPage(password) {
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const signButton = [...document.querySelectorAll(`#sign, input[name="sign"], button, input[type="button"], input[type="submit"], [role="button"]`)].find((element) => {
    const label = (element.innerText || element.value || element.getAttribute("aria-label") || "").trim().toLowerCase();
    return (element.id === "sign" || element.name === "sign" || label === "sign") && !element.disabled && isVisible(element);
  });

  if (!signButton) {
    return { ok: false, verified: false, message: "No Sign button was found on this page." };
  }

  signButton.scrollIntoView({ block: "center", behavior: "smooth" });
  signButton.click();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const input = document.querySelector('#myPanelDiv input#password, #myPanelDiv input[name="password"]' );
    if (input && isVisible(input)) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, password);
      else input.value = password;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      const verifyButton = [...document.querySelectorAll(`#myPanelDiv button, #myPanelDiv input[type="button"], #myPanelDiv input[type="submit"]`)].find((element) => {
        const label = (element.innerText || element.value || "").trim().toLowerCase();
        return label === "verify password" && !element.disabled && isVisible(element);
      });
      if (verifyButton) {
        verifyButton.click();
        return { ok: true, verified: true, count: 1 };
      }
    }
    await wait(250);
  }

  return { ok: true, verified: false, count: 1, message: "Sign clicked, but the password dialog was not ready." };
}

export async function sendSignMessage(tabId, password) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: "signAndVerify" });
  } catch (error) {
    if (!String(error?.message || error).includes("Receiving end does not exist")) throw error;
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: signAndVerifyInPage,
      args: [password],
    });
    return result?.result;
  }
}

export default function Sign() {
  const [signing, setSigning] = useState(false);
  const hoverCooldown = useRef(false);

  async function handleSign() {
    if (hoverCooldown.current) return;

    const tab = await getActiveTabSafe();
    if (!tab?.id) {
      toast.info("Open the tender preparation page before using Sign.");
      return;
    }

    const saved = await chrome.storage.local.get(ENCRYPT_PASSWORD_KEY);
    const password = saved?.[ENCRYPT_PASSWORD_KEY];
    if (!password) {
      toast.info("Enter and save a password before using Sign.");
      return;
    }

    hoverCooldown.current = true;
    try {
      setSigning(true);
      const result = await sendSignMessage(tab.id, password);
      console.log("[Sign] Response from page:", result);
      if (!result?.ok) {
        toast.info(result?.message || "No Sign button was found.");
      } else if (result.verified) {
        toast.info("Sign password verified.");
      } else {
        toast.info(result?.message || "Sign clicked, but password verification did not start.");
      }
    } catch (error) {
      console.error(error);
      const errorMessage = String(error?.message || error);
      if (errorMessage.includes("Receiving end does not exist") || errorMessage.includes("Frame with ID 0 was removed")) {
        toast.info("Reload the target page, then try Sign again.");
      } else {
        toast.info("This page cannot be controlled by the extension.");
      }
    } finally {
      setSigning(false);
      window.setTimeout(() => {
        hoverCooldown.current = false;
      }, 1500);
    }
  }

  return (
    <button type="button" className="hover-action grow" onMouseEnter={handleSign} disabled={signing}>
      {signing ? "Signing..." : "Sign"}
    </button>
  );
}