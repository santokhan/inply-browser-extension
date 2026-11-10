import { useEffect, useState } from "react";
import { getCustomerSession } from "../utils/customerLogin";

export default function useCustomerSession() {
  const [loggedIn, setLoggedIn] = useState(null);

  useEffect(() => {
    let active = true;
    let version = 0;
    const refresh = async () => {
      const request = ++version;
      try {
        const session = await getCustomerSession();
        if (active && request === version) setLoggedIn(session.loggedIn);
      } catch {
        if (active && request === version) setLoggedIn(null);
      }
    };
    const onActivated = () => { setLoggedIn(null); void refresh(); };
    const onUpdated = (_id, change) => {
      if (change.status || change.url) { setLoggedIn(null); void refresh(); }
    };

    void refresh();
    // Also catches login/logout changes rendered without a full navigation.
    const timer = window.setInterval(refresh, 2000);
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    window.addEventListener("focus", onActivated);
    return () => {
      active = false;
      window.clearInterval(timer);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      window.removeEventListener("focus", onActivated);
    };
  }, []);

  return loggedIn;
}
