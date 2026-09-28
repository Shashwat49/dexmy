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
  // Restore authenticated session from HttpOnly cookies
  // ----------------------------------------------------------

  useEffect(() => {
    async function restoreSession() {
      try {
        await authApi.getCsrfToken();

        const currentUser = await authApi.getMe();

        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
  }

    restoreSession();
}, []);

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

    setUser(data.user);

    return data.user;
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