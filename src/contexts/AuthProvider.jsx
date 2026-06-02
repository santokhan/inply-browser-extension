import { createContext, useCallback, useEffect, useState } from "react";
import { normalizeJwtToken, verifyJwt } from "../utils/token";
import { get_current_user, get_token } from "../firebase/methods";

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
    try {
      const token = await get_token();
      const user = await get_current_user();

      if (token) {
        setToken(token);
        setUser(user.toJSON());
      } else {
        setToken(null);
        setUser(null);
      }
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
        setToken,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
