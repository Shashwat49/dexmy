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

  // ----------------------------------------------------------
  // Restore authenticated session
  // ----------------------------------------------------------

  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem("dexmy_token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await authApi.getMe();

        setUser(currentUser);
        localStorage.setItem(
          "dexmy_user",
          JSON.stringify(currentUser)
        );
      } catch {
        localStorage.removeItem("dexmy_token");
        localStorage.removeItem("dexmy_user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  // ----------------------------------------------------------
  // Keep local user copy synchronized
  // ----------------------------------------------------------

  useEffect(() => {
    if (user) {
      localStorage.setItem(
        "dexmy_user",
        JSON.stringify(user)
      );
    } else {
      localStorage.removeItem("dexmy_user");
    }
  }, [user]);

  // ----------------------------------------------------------
  // Login
  // ----------------------------------------------------------

  async function login(email, password) {
    setLoading(true);

    try {
      const data = await authApi.login({
        email,
        password,
      });

      localStorage.setItem(
        "dexmy_token",
        data.access_token
      );

      setUser(data.user);

      return data.user;
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Signup
  // ----------------------------------------------------------

  async function signup(payload) {
    setLoading(true);

    try {
      const data = await authApi.signup(payload);

      localStorage.setItem(
        "dexmy_token",
        data.access_token
      );

      setUser(data.user);

      return data.user;
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Logout
  // ----------------------------------------------------------

  function logout() {
    localStorage.removeItem("dexmy_token");
    localStorage.removeItem("dexmy_user");

    setUser(null);
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
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return ctx;
}