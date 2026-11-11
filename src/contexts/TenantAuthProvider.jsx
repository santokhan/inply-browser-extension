import { createContext, useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { tenantAuth } from "../firebase/config";
import Loading from "../components/loading";

export const TenantAuthContext = createContext(null);

const TENANT_TOKEN_KEY = "auth_token";
const TENANT_KEY = "auth_user";

export function TenantAuthProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [tenantToken, setTenantToken] = useState(null);
  const [tenantAuthLoading, setTenantAuthLoading] = useState(true);

  // Restore the cached extension session first. Firebase can take a moment to
  // restore its own session, so it should not block the popup from rendering.
  const refreshTenantAuth = useCallback(async () => {
    let storageLoaded = false;
    let firebaseResolved = false;
    let finished = false;

    const finishIfReady = () => {
      if (!finished && storageLoaded && firebaseResolved) {
        finished = true;
        setTenantAuthLoading(false);
      }
    };

    chrome.storage.local.get([TENANT_TOKEN_KEY, TENANT_KEY]).then((stored) => {
      storageLoaded = true;

      if (stored[TENANT_TOKEN_KEY] && stored[TENANT_KEY]) {
        setTenantToken(stored[TENANT_TOKEN_KEY]);
        setTenant(stored[TENANT_KEY]);
        // Cached auth is enough to render immediately. Firebase is still
        // allowed to reconcile the session in the background below.
        finished = true;
        setTenantAuthLoading(false);
      }

      finishIfReady();
    });

    const unsubscribe = onAuthStateChanged(tenantAuth, async (firebaseTenant) => {
      firebaseResolved = true;

      if (firebaseTenant) {
        // Render from Firebase's local tenant object without waiting for the
        // network-backed tenant token refresh.
        const firebaseTenantData = firebaseTenant.toJSON();
        setTenant(firebaseTenantData);
        setTenantAuthLoading(false);
        finished = true;

        try {
          const firebaseToken = await firebaseTenant.getIdToken();
          setTenantToken(firebaseToken);
          await chrome.storage.local.set({
            [TENANT_TOKEN_KEY]: firebaseToken,
            [TENANT_KEY]: firebaseTenantData,
          });
        } catch (error) {
          console.error("Unable to refresh tenant authentication token", error);
        }
      } else if (!storageLoaded) {
        finishIfReady();
      } else if (!finished) {
        finished = true;
        setTenantAuthLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let unsubscribe;
    refreshTenantAuth().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => unsubscribe?.();
  }, [refreshTenantAuth]);

  // Logout
  const signOutTenant = useCallback(async () => {
    await chrome.storage.local.remove([TENANT_TOKEN_KEY, TENANT_KEY]);

    setTenantToken(null);
    setTenant(null);
  }, []);

  return (
    <TenantAuthContext.Provider
      value={{
        tenant,
        tenantToken,
        tenantAuthLoading,
        signOutTenant,
        refreshTenantAuth,
        setTenantToken,
        setTenant,
      }}
    >
      {tenantAuthLoading ? <Loading /> : children}
    </TenantAuthContext.Provider>
  );
}
