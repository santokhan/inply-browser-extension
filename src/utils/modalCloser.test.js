import assert from "node:assert/strict";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import { installModalCloser } from "../content/modalCloser.js";

function page({ title = "Tenderer Database", present = true, dismisses = true, origin = "https://www.eprocure.gov.bd", signedIn = true, logoutHref = "/Logout.jsp", logoutVisible = true } = {}) {
  let clicks = 0;
  let callback;
  let observers = 0;
  let disconnected = false;
  let onPagehide;
  const style = () => ({ setProperty(name, value) { this[name] = value; } });
  const overlay = { style: style() };
  const popup = {
    style: style(), isConnected: true,
    querySelector(selector) {
      if (selector === "#popup_title") return { textContent: title };
      if (selector === "#popup_content.tendererAlert") return {};
      if (selector === "#popup_ok") return { click() {
        clicks += 1;
        if (dismisses) { present = false; popup.isConnected = false; }
      } };
    },
  };
  const context = createContext({
    URL,
    window: { location: { origin, href: `${origin}/` }, addEventListener: (_event, handler) => { onPagehide = handler; } },
    document: {
      documentElement: {},
      querySelectorAll: () => signedIn ? [{ href: logoutHref, getClientRects: () => logoutVisible ? [1] : [] }] : [],
      getElementById: (id) => id === "popup_container" ? present ? popup : null : id === "popup_overlay" ? overlay : null,
    },
    getComputedStyle: (element) => ({ display: element.style.display || "block" }),
    MutationObserver: class {
      constructor(handler) { observers += 1; callback = handler; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  });
  const install = (options = {}) => runInContext(`(${installModalCloser.toString()})(${JSON.stringify(options)})`, context);
  return {
    install, popup, overlay,
    show() { present = true; callback(); },
    signIn() { signedIn = true; callback(); },
    signOut() { signedIn = false; callback(); },
    cleanup() { onPagehide(); },
    get clicks() { return clicks; }, get observers() { return observers; },
    get disconnected() { return disconnected; },
  };
}

test("dismisses the existing Tenderer Database notice through OK", () => {
  const browser = page();
  browser.install();
  assert.equal(browser.clicks, 1);
});

test("observes a notice inserted after login and avoids duplicate observers", () => {
  const browser = page({ present: false });
  browser.install();
  browser.install();
  assert.equal(browser.observers, 1);
  browser.show();
  assert.equal(browser.clicks, 1);
  browser.cleanup();
  assert.equal(browser.disconnected, true);
});

test("leaves unrelated dialogs alone", () => {
  const otherDialog = page({ title: "Confirm Save" });
  otherDialog.install();
  assert.equal(otherDialog.clicks, 0);
  assert.equal(otherDialog.popup.style.display, undefined);

});

test("hides the notice and overlay when OK has no working handler", () => {
  const browser = page({ dismisses: false });
  browser.install();
  assert.equal(browser.clicks, 1);
  assert.equal(browser.popup.style.display, "none");
  assert.equal(browser.overlay.style.display, "none");
  browser.install();
  assert.equal(browser.clicks, 1);
});

test("does nothing before login and closes the notice once sign-in is confirmed", () => {
  const browser = page({ signedIn: false });
  browser.install();
  browser.show();
  assert.equal(browser.clicks, 0);
  assert.equal(browser.popup.style.display, undefined);
  assert.equal(browser.overlay.style.display, undefined);
  browser.signIn();
  assert.equal(browser.clicks, 1);
});

test("does not treat hidden or foreign logout links as a signed-in session", () => {
  for (const options of [{ logoutVisible: false }, { logoutHref: "https://example.com/Logout.jsp" }]) {
    const browser = page(options);
    browser.install();
    assert.equal(browser.clicks, 0);
  }
});

test("stops closing notices after sign-out without a page reload", () => {
  const browser = page({ present: false });
  browser.install();
  browser.signOut();
  browser.show();
  assert.equal(browser.clicks, 0);
});

test("profile navigation uses the background-confirmed session when Logout is collapsed", () => {
  const browser = page({ logoutVisible: false });
  const result = browser.install({ sessionConfirmed: true });
  assert.equal(result.ready, true);
  assert.equal(browser.clicks, 1);
});

test("a confirmed session can continue to View Profile when there is no login notice", () => {
  const browser = page({ present: false, logoutVisible: false });
  browser.install();
  const result = browser.install({ sessionConfirmed: true });
  assert.equal(result.ready, true);
  assert.equal(browser.clicks, 0);
});
