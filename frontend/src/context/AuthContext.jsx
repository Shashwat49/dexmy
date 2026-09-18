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

  // ----------------------------------------------------------
  // Restore authenticated session
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const currentUser = await authApi.getMe();

        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // ----------------------------------------------------------
  // Login
  // ----------------------------------------------------------

  async function login(email, password) {
    setLoading(true);

    try {
      // Backend sets HttpOnly access/refresh cookies.
      const currentUser = await authApi.login({
        email,
        password,
      });

      setUser(currentUser);

      return currentUser;
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
      // Backend sets HttpOnly access/refresh cookies.
      const currentUser = await authApi.signup(payload);

      setUser(currentUser);

      return currentUser;
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Logout
  // ----------------------------------------------------------

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Even if the server-side logout request fails,
      // clear the frontend authentication state.
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
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return ctx;
}