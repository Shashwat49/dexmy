import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("dexmy_user");

    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem("dexmy_user");
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Restore the current session when this tab first loads.
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const token = localStorage.getItem("dexmy_token");

      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const currentUser = await authApi.getMe();

        if (!active) return;
        setUser(currentUser);
        localStorage.setItem("dexmy_user", JSON.stringify(currentUser));
      } catch {
        if (!active) return;
        localStorage.removeItem("dexmy_token");
        localStorage.removeItem("dexmy_user");
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

  // localStorage is shared by tabs on the same origin, but React state is
  // not. Listen for login/logout token changes made by another tab and
  // synchronize this tab's authenticated user state.
  useEffect(() => {
    let active = true;

    async function handleStorage(event) {
      if (event.key !== "dexmy_token") return;

      if (!event.newValue) {
        localStorage.removeItem("dexmy_user");
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
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

    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Keep the local user copy synchronized.
  useEffect(() => {
    if (user) {
      localStorage.setItem("dexmy_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("dexmy_user");
    }
  }, [user]);

  async function login(email, password) {
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      localStorage.setItem("dexmy_token", data.access_token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  async function signup(payload) {
    setLoading(true);
    try {
      const data = await authApi.signup(payload);
      localStorage.setItem("dexmy_token", data.access_token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("dexmy_token");
    localStorage.removeItem("dexmy_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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
