import { createContext, useCallback, useEffect, useState } from "react";
import { normalizeJwtToken, verifyJwt } from "../utils/token";

export const AuthContext = createContext(null);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const TOKEN_SECRET = "santokhanhasdevelopedthisbrowserextension";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load auth from storage
  const loadAuth = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get([TOKEN_KEY, USER_KEY]);
      const storedToken = normalizeJwtToken(result[TOKEN_KEY] || null) || null;
      const storedUser = result[USER_KEY] || null;

      const tokenCheck = storedToken ? await verifyJwt(storedToken, TOKEN_SECRET) : { ok: false };

      if (storedToken && !tokenCheck.ok) {
        await chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);
        setToken(null);
        setUser(null);
        return;
      }

      setToken(storedToken);
      setUser(storedUser);
    } catch (err) {
      console.error("Auth load error:", err);
    } finally {
      setLoading(false);
    }
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

  // Check if logged in
  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        login,
        logout,
        loadAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
