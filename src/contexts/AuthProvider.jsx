import { createContext, useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { normalizeJwtToken, verifyJwt } from "../utils/token";
import { get_current_user, get_token } from "../firebase/methods";
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

  // Load auth from storage
  const loadAuth = useCallback(async () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();

        setToken(token);
        setUser(user.toJSON());
      } else {
        setToken(null);
        setUser(null);
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadAuth();
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
