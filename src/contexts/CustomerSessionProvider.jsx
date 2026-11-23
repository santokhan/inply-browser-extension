import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "../hooks/useTenantAuth";
import { CustomerSessionContext } from "../hooks/useCustomerSession";
import { ACTIVE_CUSTOMER_KEY, activateExtensionCustomer, restoreExtensionCustomer } from "../utils/extensionCustomer";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, tenantAuth } from "../firebase/config";
import { tenantCustomerPath } from "../data/tenantCustomerPaths";
import { CUSTOMER_LOGOUT_ACTION } from "../utils/customerLogin";
import { COLLECT_CUSTOMER_PROFILE_ACTION, CUSTOMER_DETAIL_FIELDS } from "../utils/customerProfile";
import { refreshTenantWallet } from "../firebase/tenantWallet";
import { profileCollectionDebit } from "../utils/tenantWallet";
import { saveCollectedProfile } from "../utils/profileCollectionBilling";
import { getActiveTabSafe } from "../utils/chrome";
import { toast } from "react-toastify";

export function CustomerSessionProvider({ children }) {
  const { tenant } = useTenantAuth();
  const [selected, setSelected] = useState(null);
  const [hasLogout, setHasLogout] = useState(false)
  const sessionRevision = useRef(0);
  const tenantUid = tenant?.uid;
  const currentCustomer = selected?.tenantUid === tenantUid ? selected : null;

  useEffect(() => {
    const onSessionChanged = (changes, area) => {
      if (area !== "local" || !changes[ACTIVE_CUSTOMER_KEY]) return;
      const customer = changes[ACTIVE_CUSTOMER_KEY].newValue;
      if (!customer) sessionRevision.current += 1;
      setSelected(customer?.tenantUid === tenantUid ? customer : null);
    };
    chrome.storage.onChanged.addListener(onSessionChanged);
    return () => chrome.storage.onChanged.removeListener(onSessionChanged);
  }, [tenantUid]);

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

  useEffect(() => {
    let active = true;
    const checkLogoutButton = async () => {
      try {
        const tab = await getActiveTabSafe();
        if (!tab?.id) {
          throw new Error("Tab ID not found.")
        }
        const result = await chrome.tabs.sendMessage(tab.id, { action: "checkLogoutButton" });
        if (active) setHasLogout(Boolean(result?.ok));
      } catch (error) {
        toast.error(error.message)
      }
    };
    checkLogoutButton();
    return () => { active = false; };
  }, []);

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
    if (!fields.length) return { remaining: [] };
    profileCollectionDebit(await refreshTenantWallet(tenantUid));
    assertCurrentSession();
    const result = await chrome.runtime.sendMessage({
      action: COLLECT_CUSTOMER_PROFILE_ACTION,
      tabId: currentCustomer.profileTabId,
      fields,
    });
    if (!result?.ok) throw new Error(result?.message || "Could not collect business details. Try again.");
    assertCurrentSession();
    const customerRef = doc(db, ...tenantCustomerPath(tenantUid, currentCustomer.id));
    const walletRef = doc(db, "tenantWallets", tenantUid);
    const details = await runTransaction(db, (transaction) => saveCollectedProfile(transaction, {
      customerRef, walletRef, customer: currentCustomer, profile: result.profile,
      assertCurrentSession, timestamp: serverTimestamp,
    }));
    assertCurrentSession();
    const updated = { ...currentCustomer, ...details, profileTabId: result.tabId };
    await chrome.storage.local.set({ [ACTIVE_CUSTOMER_KEY]: updated });
    assertCurrentSession();
    setSelected(updated);
    const remaining = CUSTOMER_DETAIL_FIELDS.filter((field) => !details[field].trim());
    return { remaining, message: result.message };
  }, [currentCustomer, tenantUid]);

  const saveBusinessDetails = useCallback(async (values) => {
    if (!currentCustomer?.id || !tenantUid) throw new Error("Log in with a saved customer before saving business details.");
    const revision = sessionRevision.current;
    const assertCurrentSession = () => {
      if (sessionRevision.current !== revision || tenantAuth.currentUser?.uid !== tenantUid) {
        throw new Error("The active customer changed. Save details again for the selected customer.");
      }
    };
    const details = Object.fromEntries(CUSTOMER_DETAIL_FIELDS
      .filter((field) => typeof values[field] === "string")
      .map((field) => [field, values[field].trim()]));
    assertCurrentSession();
    const customerRef = doc(db, ...tenantCustomerPath(tenantUid, currentCustomer.id));
    const savedDetails = await runTransaction(db, async (transaction) => {
      assertCurrentSession();
      const snapshot = await transaction.get(customerRef);
      if (!snapshot.exists()) throw new Error("The customer was removed before business details could be saved.");
      const saved = snapshot.data();
      if (saved.email?.trim().toLowerCase() !== currentCustomer.email.trim().toLowerCase()) {
        throw new Error("The customer email changed. Log in with the updated customer to save details.");
      }
      assertCurrentSession();
      transaction.update(customerRef, { ...details, updatedAt: serverTimestamp() });
      return Object.fromEntries(CUSTOMER_DETAIL_FIELDS.map((field) => [field, details[field] ?? saved[field] ?? ""]));
    });
    assertCurrentSession();
    const updated = { ...currentCustomer, ...savedDetails };
    await chrome.storage.local.set({ [ACTIVE_CUSTOMER_KEY]: updated });
    assertCurrentSession();
    setSelected(updated);
  }, [currentCustomer, tenantUid]);

  return (
    <CustomerSessionContext.Provider value={{ currentCustomer, hasLogout, recordCustomerLogin, signOutCustomer, collectBusinessDetails, saveBusinessDetails }}>
      {children}
    </CustomerSessionContext.Provider>
  );
}
