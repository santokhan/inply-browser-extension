// Self-contained so the root component can install it in existing browser tabs.
export function installModalCloser() {
  if (window.location.origin !== "https://www.eprocure.gov.bd") return { closed: false, message: "Open an eProcure tab to test the modal closer." };
  if (window.InplyModalCloser) {
    return window.InplyModalCloser.close();
  }

  const close = () => {
    const signedIn = [...document.querySelectorAll("a[href]")].some((anchor) => {
      const url = new URL(anchor.href, window.location.href);
      return url.origin === window.location.origin && url.pathname === "/Logout.jsp" &&
        anchor.getClientRects().length > 0;
    });
    if (!signedIn) return { closed: false, message: "Sign in to eProcure before testing the modal closer." };
    const popup = document.getElementById("popup_container");
    if (!popup || popup.hidden || getComputedStyle(popup).display === "none") {
      return { closed: false, message: "No visible Tenderer Database modal found. Automatic closing is active." };
    }
    const title = popup.querySelector("#popup_title")?.textContent.trim();
    const content = popup.querySelector("#popup_content.tendererAlert");
    const ok = popup.querySelector("#popup_ok");
    if (title !== "Tenderer Database" || !content || !ok) {
      return { closed: false, message: "The visible popup is not the Tenderer Database notice." };
    }

    // Use the site's OK handler to remove the dialog and its overlay normally.
    ok.click();
    // A notice may appear before its handler is attached. Hide that exact
    // notice and its overlay if clicking did not dismiss it.
    if (popup.isConnected && getComputedStyle(popup).display !== "none") {
      popup.style.setProperty("display", "none", "important");
      document.getElementById("popup_overlay")?.style.setProperty("display", "none", "important");
    }
    return { closed: true, message: "Tenderer Database modal closed." };
  };
  const observer = new MutationObserver(close);
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["style", "class", "hidden"],
    characterData: true,
  });
  window.InplyModalCloser = { close };
  window.addEventListener("pagehide", () => {
    observer.disconnect();
    delete window.InplyModalCloser;
  }, { once: true });
  return close();
}
