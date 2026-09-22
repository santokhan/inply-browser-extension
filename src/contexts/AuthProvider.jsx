import { createContext, useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { normalizeJwtToken, verifyJwt } from "../utils/token";
import { auth } from "../firebase/config";
import Loading from "../components/loading";

export const AuthContext = createContext(null);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
export const TOKEN_SECRET = "santokhanhasdevelopedthisbrowserextension";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the cached extension session first. Firebase can take a moment to
  // restore its own session, so it should not block the popup from rendering.
  const loadAuth = useCallback(async () => {
    let storageLoaded = false;
    let firebaseResolved = false;
    let finished = false;

    const finishIfReady = () => {
      if (!finished && storageLoaded && firebaseResolved) {
        finished = true;
        setLoading(false);
      }
    };

    chrome.storage.local.get([TOKEN_KEY, USER_KEY]).then((stored) => {
      storageLoaded = true;

      if (stored[TOKEN_KEY] && stored[USER_KEY]) {
        setToken(stored[TOKEN_KEY]);
        setUser(stored[USER_KEY]);
        // Cached auth is enough to render immediately. Firebase is still
        // allowed to reconcile the session in the background below.
        finished = true;
        setLoading(false);
      }

      finishIfReady();
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      firebaseResolved = true;

      if (firebaseUser) {
        // Render from Firebase's local user object without waiting for the
        // network-backed token refresh.
        const firebaseUserData = firebaseUser.toJSON();
        setUser(firebaseUserData);
        setLoading(false);
        finished = true;

        try {
          const firebaseToken = await firebaseUser.getIdToken();
          setToken(firebaseToken);
          await chrome.storage.local.set({
            [TOKEN_KEY]: firebaseToken,
            [USER_KEY]: firebaseUserData,
          });
        } catch (error) {
          console.error("Unable to refresh authentication token", error);
        }
      } else if (!storageLoaded) {
        finishIfReady();
      } else if (!finished) {
        finished = true;
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let unsubscribe;
    loadAuth().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => unsubscribe?.();
  }, [loadAuth]);

  // Login
  const login = useCallback(async ({ token, user }) => {
    const trimmedToken = normalizeJwtToken(token);

    if (!trimmedToken) {
      throw new Error("Token is required");
    }

    const tokenCheck = await verifyJwt(trimmedToken, TOKEN_SECRET);

    if (!tokenCheck.ok) {
      throw new Error(tokenCheck.reason || "Login failed");
    }

    await chrome.storage.local.set({
      [TOKEN_KEY]: trimmedToken,
      [USER_KEY]: user,
    });

    setToken(trimmedToken);
    setUser(user);
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);

    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        loadAuth,
        setToken,
        setUser,
      }}
    >
      {loading ? <Loading /> : children}
    </AuthContext.Provider>
  );
}
