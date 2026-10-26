(() => {
  const PENDING_SIGN_ENCRYPT_SAVE_KEY = "pendingSignEncryptSave";
  const PENDING_ENCRYPT_AND_SAVE_KEY = "pendingEncryptAndSave";
  const PASSWORD_KEY = "encryptPassword";

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const labelOf = (element) =>
    (element.innerText || element.value || element.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ").trim().toLowerCase();
  const findButton = (selector, predicate) =>
    [...document.querySelectorAll(selector)].find((element) =>
      predicate(element) && !element.disabled && isVisible(element));
  const getSignButton = () => findButton(
    '#sign, input[name="sign"], button, input[type="button"], input[type="submit"], [role="button"]',
    (element) => element.id === "sign" || element.name === "sign" || labelOf(element) === "sign",
  );
  const getEncryptAndSaveButton = () => findButton(
    '#encrypt, input[name="encrypt"], button, input[type="button"], input[type="submit"], [role="button"]',
    (element) => ["encrypt and save", "encrypt"].includes(labelOf(element)),
  );
  const getSaveButton = () => findButton(
    '#save, input[name="save"], button, input[type="submit"], input[type="button"], [role="button"]',
    (element) => element.id === "save" || element.name === "save" || labelOf(element) === "save",
  );
  const waitForButton = async (getButton, timeout = 10000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const button = getButton();
      if (button) return button;
      await wait(250);
    }
    return getButton();
  };

  async function fillAndVerifyPassword() {
    let password;
    try {
      password = (await chrome.storage.local.get(PASSWORD_KEY))?.[PASSWORD_KEY];
    } catch (error) {
      console.warn("[Sign] Could not read saved password:", error);
      return false;
    }
    if (!password) return false;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const input = document.querySelector(
        '#myPanelDiv input#password, #myPanelDiv input[name="password"], #dialog-form input#password, #dialog-form input[name="password"]',
      );
      if (input && isVisible(input)) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(input, password);
        else input.value = password;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        const dialog = input.closest(".ui-dialog") || input.closest("#myPanelDiv, #dialog-form");
        const verifyButton = [...(dialog?.querySelectorAll('button, input[type="button"], input[type="submit"]') || [])]
          .find((element) => labelOf(element) === "verify password" && !element.disabled && isVisible(element));
        if (verifyButton) {
          verifyButton.click();
          return true;
        }
      }
      await wait(250);
    }
    return false;
  }

  async function signAndVerify() {
    const button = await waitForButton(getSignButton);
    if (!button) return { ok: false, verified: false, message: "No Sign button was found on this page." };
    button.scrollIntoView({ block: "center", behavior: "smooth" });
    button.click();
    const verified = await fillAndVerifyPassword();
    return verified
      ? { ok: true, verified: true, count: 1 }
      : { ok: true, verified: false, count: 1, message: "Sign clicked, but the password dialog was not ready." };
  }

  async function clickEncryptConfirmationOk() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const instructionDialog = document.querySelector("#encrypt-dialog-message")?.closest(".ui-dialog");
      const instructionOk = instructionDialog && [...instructionDialog.querySelectorAll(".ui-dialog-buttonpane button, button")]
        .find((element) => labelOf(element) === "ok" && !element.disabled && isVisible(element));
      if (instructionOk) {
        const form = document.getElementById("frmBidSubmit");
        let actionField = document.getElementById("action") || document.querySelector('input[name="action"]');
        if (!actionField && form) {
          actionField = document.createElement("input");
          actionField.type = "hidden";
          actionField.id = "action";
          actionField.name = "action";
          form.appendChild(actionField);
        } else if (actionField && !actionField.id) actionField.id = "action";
        if (actionField && form && !form.contains(actionField)) form.appendChild(actionField);
        if (!actionField || !form || !form.contains(actionField)) {
          return { ok: false, message: "Could not prepare the Encrypt And Save action field." };
        }
        instructionOk.click();
        return { ok: true, willSubmit: true };
      }

      const okButton = findButton(
        '#myPanelDiv button, #myPanelDiv input[type="button"], #myPanelDiv input[type="submit"]',
        (element) => labelOf(element) === "ok",
      );
      if (okButton) {
        okButton.click();
        return { ok: true, willSubmit: false };
      }
      await wait(250);
    }
    return { ok: false, message: "Encrypt confirmation did not appear." };
  }

  async function encryptAndSave({ persistPending = true } = {}) {
    const button = await waitForButton(getEncryptAndSaveButton);
    if (!button) return { ok: false, count: 0, message: "No Encrypt And Save button was found on this page." };
    if (persistPending) {
      await chrome.storage.local.set({ [PENDING_ENCRYPT_AND_SAVE_KEY]: { createdAt: Date.now() } });
    }
    button.scrollIntoView({ block: "center", behavior: "smooth" });
    button.click();
    const confirmation = await clickEncryptConfirmationOk();
    return {
      ok: confirmation.ok,
      count: 1,
      confirmed: confirmation.ok,
      willSubmit: confirmation.willSubmit,
      message: confirmation.message,
    };
  }

  async function save() {
    const button = await waitForButton(getSaveButton);
    if (!button) return { ok: false, count: 0, message: "No Save button was found on this page." };
    button.scrollIntoView({ block: "center", behavior: "smooth" });
    button.click();
    console.log("[Save] Clicked Save; the page chkValidate handler is running.");
    return { ok: true, count: 1 };
  }

  async function onlyEncrypt() {
    const button = await waitForButton(() => findButton(
      'input#encrypt, input[name="encrypt"], input[type="button"]',
      (element) => element.id === "encrypt" || element.name === "encrypt" || labelOf(element) === "encrypt",
    ));
    if (!button) return { ok: false, verified: false, message: "No enabled Encrypt button appeared within 10 seconds." };
    button.scrollIntoView({ block: "center", behavior: "smooth" });
    button.click();
    return { ok: true, count: 1 };
  }

  async function onlySave() {
    const button = await waitForButton(getSaveButton);
    if (!button) return { ok: false, verified: false, message: "No enabled Save button appeared within 10 seconds." };
    button.scrollIntoView({ block: "center", behavior: "smooth" });
    button.click();
    return { ok: true, count: 1 };
  }

  async function runPendingSignEncryptSave() {
    const signResult = await signAndVerify();
    if (!signResult.ok || !signResult.verified) {
      console.warn("[Sign Encrypt Save] Could not complete Sign before Encrypt:", signResult.message);
      return;
    }
    await wait(2000);
    const encryptResult = await encryptAndSave({ persistPending: false });
    if (!encryptResult.ok || !encryptResult.confirmed) {
      console.warn("[Sign Encrypt Save] Could not complete Encrypt and Save:", encryptResult.message);
      return;
    }
    console.log("[Sign Encrypt Save] Completed the requested flow.");
  }

  async function resumePendingSignEncryptSave() {
    const pending = (await chrome.storage.local.get(PENDING_SIGN_ENCRYPT_SAVE_KEY))?.[PENDING_SIGN_ENCRYPT_SAVE_KEY];
    if (!pending) return false;
    await chrome.storage.local.remove(PENDING_SIGN_ENCRYPT_SAVE_KEY);
    if (Date.now() - pending.createdAt > 120000) return false;
    console.log("[Sign Encrypt Save] Resuming the requested flow after navigation.");
    await runPendingSignEncryptSave();
    return true;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const actions = { signAndVerify, encryptAndSave, save, onlyEncrypt, onlySave };
    if (!Object.hasOwn(actions, message.action)) return false;
    const action = actions[message.action];
    action().then(sendResponse);
    return true;
  });

  window.InplySignEncryptSave = { resumePendingSignEncryptSave };
})();
