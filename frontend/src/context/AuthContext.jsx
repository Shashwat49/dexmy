import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore an authenticated session from HttpOnly cookies using CSRF and
  // the current user endpoint. The backend owns the access/refresh cookies.
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        await authApi.getCsrfToken();
        const currentUser = await authApi.getMe();

        if (!active) return;
        setUser(currentUser);
      } catch {
        if (!active) return;
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    setLoading(true);

    try {
      await authApi.getCsrfToken();
      const data = await authApi.login({ email, password });
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  async function signup(payload) {
    setLoading(true);

    try {
      await authApi.getCsrfToken();
      const data = await authApi.signup(payload);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return ctx;
}
