import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("dexmy_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

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
      // Signup does NOT log the user in — email verification is required
      // first (see backend auth flow). Returns a { message } response.
      return await authApi.signup(payload);
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
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
