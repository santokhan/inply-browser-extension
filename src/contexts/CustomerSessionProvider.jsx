import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "../hooks/useTenantAuth";
import { CustomerSessionContext } from "../hooks/useCustomerSession";
import { ACTIVE_CUSTOMER_KEY, activateExtensionCustomer, restoreExtensionCustomer } from "../utils/extensionCustomer";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { tenantCustomerPath } from "../data/tenantCustomerPaths";
import { CUSTOMER_LOGOUT_ACTION } from "../utils/customerLogin";

export function CustomerSessionProvider({ children }) {
  const { tenant } = useTenantAuth();
  const [selected, setSelected] = useState(null);
  const sessionRevision = useRef(0);
  const tenantUid = tenant?.uid;
  const currentCustomer = selected?.tenantUid === tenantUid ? selected : null;

  useEffect(() => {
    let active = true;
    const revision = sessionRevision.current;
    setSelected((current) => current?.tenantUid === tenantUid ? current : null);
    if (tenantUid) {
      chrome.storage.local.get(ACTIVE_CUSTOMER_KEY).then(async (saved) => {
        const restored = await restoreExtensionCustomer(saved[ACTIVE_CUSTOMER_KEY], tenantUid, async (id) => {
          const snapshot = await getDoc(doc(db, ...tenantCustomerPath(tenantUid, id)));
          return snapshot.exists() ? snapshot.data() : null;
        });
        if (active && revision === sessionRevision.current) {
          setSelected((current) => current?.tenantUid === tenantUid ? current : restored);
        }
      }).catch((error) => console.error("Could not restore the extension customer:", error));
    }
    return () => { active = false; };
  }, [tenantUid]);

  const recordCustomerLogin = useCallback(async (customer, loginResult) => {
    sessionRevision.current += 1;
    const active = await activateExtensionCustomer({ tenantUid, customer, loginResult },
      (values) => chrome.storage.local.set(values));
    if (active) setSelected(active);
  }, [tenantUid]);

  const signOutCustomer = useCallback(async () => {
    sessionRevision.current += 1;
    const result = await chrome.runtime.sendMessage({ action: CUSTOMER_LOGOUT_ACTION });
    if (!result?.ok) throw new Error(result?.message || "Could not log out of eProcure.");
    await chrome.storage.local.remove(ACTIVE_CUSTOMER_KEY);
    setSelected(null);
  }, []);

  return (
    <CustomerSessionContext.Provider value={{ currentCustomer, recordCustomerLogin, signOutCustomer }}>
      {children}
    </CustomerSessionContext.Provider>
  );
}
