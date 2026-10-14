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

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      // Remove legacy browser-stored access tokens as the cookie session becomes authoritative.
      localStorage.removeItem("dexmy_token");
      localStorage.removeItem("token");
      localStorage.removeItem("teacherToken");
      try {
        await authApi.getCsrfToken();
        const currentUser = await authApi.getMe();
        if (!active) return;
        setUser(currentUser);
        localStorage.setItem("dexmy_user", JSON.stringify(currentUser));
      } catch {
        if (!active) return;
        setUser(null);
        localStorage.removeItem("dexmy_user");
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      localStorage.removeItem("dexmy_user");
    };
    window.addEventListener("dexmy:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("dexmy:auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    const handleStorage = async (event) => {
      if (event.key !== "dexmy_user") return;
      if (!event.newValue) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const currentUser = await authApi.getMe();
        setUser(currentUser);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem("dexmy_user", JSON.stringify(user));
    else localStorage.removeItem("dexmy_user");
  }, [user]);

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
    } catch {
      // Clear local UI state even if the session has already expired.
    } finally {
      setUser(null);
      localStorage.removeItem("dexmy_user");
      localStorage.removeItem("dexmy_token");
      localStorage.removeItem("token");
      localStorage.removeItem("teacherToken");
      window.dispatchEvent(new Event("dexmy:auth-expired"));
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
