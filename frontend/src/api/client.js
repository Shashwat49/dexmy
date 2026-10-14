import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let csrfToken = null;
let refreshPromise = null;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  "/auth/csrf",
  "/auth/login",
  "/auth/signup",
  "/auth/refresh",
  "/auth/logout",
];

async function ensureCsrfToken(force = false) {
  if (force) csrfToken = null;
  if (csrfToken) return csrfToken;
  const { data } = await api.get("/auth/csrf");
  csrfToken = data?.csrf_token || null;
  if (!csrfToken) throw new Error("Unable to initialize CSRF protection.");
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

api.interceptors.request.use(async (config) => {
  const method = String(config.method || "GET").toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    config.headers = config.headers || {};
    config.headers["X-CSRF-Token"] = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config?.url?.includes("/auth/csrf") && response.data?.csrf_token) {
      csrfToken = response.data.csrf_token;
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const url = String(original?.url || "");
    const isAuthEndpoint = AUTH_ENDPOINTS_WITHOUT_REFRESH.some((path) => url.includes(path));

    // If the server rotated/expired its CSRF cookie, initialize a fresh pair
    // and retry a mutation only once.
    if (
      error.response?.status === 403 &&
      /csrf/i.test(String(error.response?.data?.detail || "")) &&
      original &&
      !original._csrfRetry &&
      !SAFE_METHODS.has(String(original.method || "GET").toUpperCase())
    ) {
      original._csrfRetry = true;
      try {
        const token = await ensureCsrfToken(true);
        original.headers = original.headers || {};
        original.headers["X-CSRF-Token"] = token;
        return api(original);
      } catch {
        // Return the original CSRF error below if recovery fails.
      }
    }

    if (
      error.response?.status !== 401 ||
      !original ||
      original._authRetry ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    original._authRetry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = api.post("/auth/refresh").finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return api(original);
    } catch (refreshError) {
      clearCsrfToken();
      localStorage.removeItem("dexmy_token");
      localStorage.removeItem("token");
      localStorage.removeItem("teacherToken");
      localStorage.removeItem("dexmy_user");
      window.dispatchEvent(new Event("dexmy:auth-expired"));
      return Promise.reject(refreshError);
    }
  }
);

export default api;
