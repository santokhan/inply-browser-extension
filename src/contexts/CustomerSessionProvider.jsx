import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "../hooks/useTenantAuth";
import { CustomerSessionContext } from "../hooks/useCustomerSession";
import { ACTIVE_CUSTOMER_KEY, activateExtensionCustomer, restoreExtensionCustomer } from "../utils/extensionCustomer";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, tenantAuth } from "../firebase/config";
import { tenantCustomerPath } from "../data/tenantCustomerPaths";
import { CUSTOMER_LOGOUT_ACTION } from "../utils/customerLogin";
import { COLLECT_CUSTOMER_PROFILE_ACTION, CUSTOMER_DETAIL_FIELDS, missingCustomerDetails } from "../utils/customerProfile";

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

  const collectBusinessDetails = useCallback(async () => {
    if (!currentCustomer?.id || !tenantUid) throw new Error("Log in with a saved customer before collecting business details.");
    const revision = sessionRevision.current;
    const assertCurrentSession = () => {
      if (sessionRevision.current !== revision || tenantAuth.currentUser?.uid !== tenantUid) {
        throw new Error("The active customer changed. Collect details again for the selected customer.");
      }
    };
    assertCurrentSession();
    const fields = CUSTOMER_DETAIL_FIELDS.filter((field) => !currentCustomer[field]?.trim());
    const result = await chrome.runtime.sendMessage({
      action: COLLECT_CUSTOMER_PROFILE_ACTION,
      tabId: currentCustomer.profileTabId,
      fields,
    });
    if (!result?.ok) throw new Error(result?.message || "Could not collect business details. Try again.");
    assertCurrentSession();
    const customerRef = doc(db, ...tenantCustomerPath(tenantUid, currentCustomer.id));
    const details = await runTransaction(db, async (transaction) => {
      assertCurrentSession();
      const snapshot = await transaction.get(customerRef);
      if (!snapshot.exists()) throw new Error("The customer was removed before business details could be saved.");
      const saved = snapshot.data();
      if (saved.email?.trim().toLowerCase() !== currentCustomer.email.trim().toLowerCase()) {
        throw new Error("The customer email changed. Log in with the updated customer to collect details.");
      }
      const missing = missingCustomerDetails(saved, result.profile);
      assertCurrentSession();
      if (Object.keys(missing).length) transaction.update(customerRef, { ...missing, updatedAt: serverTimestamp() });
      return Object.fromEntries(CUSTOMER_DETAIL_FIELDS.map((field) => [field, missing[field] || saved[field] || ""]));
    });
    assertCurrentSession();
    const updated = { ...currentCustomer, ...details, profileTabId: result.tabId };
    await chrome.storage.local.set({ [ACTIVE_CUSTOMER_KEY]: updated });
    assertCurrentSession();
    setSelected(updated);
    const remaining = CUSTOMER_DETAIL_FIELDS.filter((field) => !details[field].trim());
    return { remaining, message: result.message };
  }, [currentCustomer, tenantUid]);

  return (
    <CustomerSessionContext.Provider value={{ currentCustomer, recordCustomerLogin, signOutCustomer, collectBusinessDetails }}>
      {children}
    </CustomerSessionContext.Provider>
  );
}
