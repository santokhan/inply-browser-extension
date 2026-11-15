import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";

import { db, tenantAuth } from "../firebase/config";
import { ACTIVE_CUSTOMER_KEY } from "../utils/extensionCustomer";
import Loading from "../components/loading";

export const TenantAuthContext = createContext(null);

const SESSION_KEYS = ["auth_token", "auth_user"];
const DISABLED_MESSAGE = "Your account has been disabled. Contact your administrator.";
const ACCESS_ERROR_MESSAGE = "Unable to verify account access. Check your connection and try signing in again.";

export function TenantAuthProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [tenantToken, setTenantToken] = useState(null);
  const [tenantAuthLoading, setTenantAuthLoading] = useState(true);
  const [tenantAuthError, setTenantAuthError] = useState("");
  const revision = useRef(0);
  const signingOut = useRef(false);
  const storageQueue = useRef(Promise.resolve());

  // Serialize cache changes so a late token write cannot undo a sign-out.
  const updateSessionCache = useCallback((values) => {
    const operation = storageQueue.current.catch(() => {}).then(() => values
      ? chrome.storage.local.set(values)
      : chrome.storage.local.remove(SESSION_KEYS));
    storageQueue.current = operation;
    return operation;
  }, []);

  const clearTenantSession = useCallback(() => {
    revision.current += 1;
    setTenant(null);
    setTenantToken(null);
    localStorage.removeItem("refreshToken");
    return updateSessionCache(null);
  }, [updateSessionCache]);

  const signOutTenant = useCallback(async () => {
    signingOut.current = true;
    await Promise.all([
      clearTenantSession(),
      chrome.storage.local.remove(ACTIVE_CUSTOMER_KEY),
      signOut(tenantAuth),
    ]);
  }, [clearTenantSession]);

  useEffect(() => {
    let unsubscribeAccess;
    let active = true;

    const unsubscribeAuth = onAuthStateChanged(tenantAuth, (firebaseTenant) => {
      unsubscribeAccess?.();
      const cleared = clearTenantSession();
      cleared.catch((error) => console.error("Unable to clear tenant session", error));

      if (!firebaseTenant) {
        setTenantAuthLoading(false);
        return;
      }

      setTenantAuthError("");
      setTenantAuthLoading(true);
      signingOut.current = false;
      let listening = true;

      const rejectAccess = (message) => {
        setTenantAuthError(message);
        setTenantAuthLoading(false);
        signOutTenant().catch((error) => console.error("Unable to sign out tenant", error));
      };

      const accessRef = doc(db, "tenants", firebaseTenant.uid);
      const stopAccess = onSnapshot(accessRef,
        { includeMetadataChanges: true }, async (snapshot) => {
          if (!active || !listening || signingOut.current || tenantAuth.currentUser !== firebaseTenant) return;
          const currentRevision = ++revision.current;
          const isCurrent = () => active && listening && !signingOut.current && revision.current === currentRevision
            && tenantAuth.currentUser === firebaseTenant;

          // Access must be confirmed by the server before exposing the session.
          if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
            setTenant(null);
            setTenantToken(null);
            setTenantAuthError(ACCESS_ERROR_MESSAGE);
            setTenantAuthLoading(false);
            updateSessionCache(null).catch((error) => console.error("Unable to clear tenant cache", error));
            return;
          }

          if (snapshot.data()?.disabled === true) {
            rejectAccess(DISABLED_MESSAGE);
            return;
          }

          try {
            if (!snapshot.exists()) {
              // A concurrent administrator change must survive initialization.
              await runTransaction(db, async (transaction) => {
                const latest = await transaction.get(accessRef);
                if (!latest.exists()) transaction.set(accessRef, { disabled: false });
              });
              return;
            }
            const token = await firebaseTenant.getIdToken();
            if (!isCurrent()) return;
            const tenantData = firebaseTenant.toJSON();
            await updateSessionCache({ auth_token: token, auth_user: tenantData });
            if (!isCurrent()) return;
            setTenantToken(token);
            setTenant(tenantData);
            setTenantAuthError("");
            setTenantAuthLoading(false);
          } catch (error) {
            if (!isCurrent()) return;
            console.error("Unable to verify tenant session", error);
            rejectAccess(ACCESS_ERROR_MESSAGE);
          }
        }, (error) => {
          if (!active || !listening || signingOut.current || tenantAuth.currentUser !== firebaseTenant) return;
          console.error("Unable to read tenant access", error);
          rejectAccess(ACCESS_ERROR_MESSAGE);
        });
      unsubscribeAccess = () => {
        listening = false;
        stopAccess();
      };
    });

    return () => {
      active = false;
      revision.current += 1;
      unsubscribeAccess?.();
      unsubscribeAuth();
    };
  }, [clearTenantSession, signOutTenant, updateSessionCache]);

  return (
    <TenantAuthContext.Provider value={{ tenant, tenantToken, tenantAuthLoading, tenantAuthError, signOutTenant }}>
      {tenantAuthLoading ? <Loading /> : children}
    </TenantAuthContext.Provider>
  );
}
