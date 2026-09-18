import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CSRF_COOKIE_NAME = "dexmy_csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split("; ") : [];

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function isUnsafeMethod(method) {
  return ["post", "put", "patch", "delete"].includes(
    String(method || "").toLowerCase(),
  );
}

function isAuthEndpoint(url = "") {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/signup") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
  );
}

// ----------------------------------------------------------
// Request interceptor
// ----------------------------------------------------------
//
// Auth credentials are HttpOnly cookies.
// JavaScript never reads the access/refresh cookies.
//
// For state-changing requests, send the separate CSRF token.
// The CSRF cookie is intentionally NOT HttpOnly so JS can read it.
// ----------------------------------------------------------

api.interceptors.request.use((config) => {
  config.withCredentials = true;

  if (isUnsafeMethod(config.method)) {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);

    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  return config;
});

// ----------------------------------------------------------
// Refresh handling
// ----------------------------------------------------------
//
// Multiple requests can receive 401 at the same time.
// Only one refresh request is allowed to run.
// Other failed requests wait for the same promise.
// ----------------------------------------------------------

let refreshPromise = null;

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then((response) => response.data)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

// ----------------------------------------------------------
// Response interceptor
// ----------------------------------------------------------

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Never refresh auth endpoints themselves.
    if (isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    // Prevent an infinite retry loop.
    if (originalRequest._retry) {
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      await refreshSession();

      // Cookies have been updated by the backend.
      // Retry the original request using the authenticated cookie session.  // Retry the original request without manually attaching JWTs.
      return api(originalRequest);
    } catch (refreshError) {
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      return Promise.reject(refreshError);
    }
  },
);

export default api;
