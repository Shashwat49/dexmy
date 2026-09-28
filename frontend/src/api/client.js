import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)dexmy_csrf=([^;]+)/);

  return match ? decodeURIComponent(match[1]) : null;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let refreshPromise = null;
// ----------------------------------------------------------
// Attach CSRF token to state-changing requests
// ----------------------------------------------------------

api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();

  if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = getCsrfToken();

    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }

  return config;
});

// ----------------------------------------------------------
// Handle unauthorized responses
// ----------------------------------------------------------

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      originalRequest?.url?.includes("/auth/refresh") ||
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/signup")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api.post("/auth/refresh").finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;

      return api(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem("dexmy_user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      return Promise.reject(refreshError);
    }
  },
);

export default api;
