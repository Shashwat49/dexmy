// Centralized Testing Service client. The testing service is separately hosted,
// so it receives a short-lived, scoped bearer token kept in memory only.
import { getTestingToken } from "./auth";

export const TESTING_API_BASE =
  import.meta.env.VITE_TESTING_API_BASE_URL ||
  import.meta.env.VITE_TESTING_API_URL ||
  "http://localhost:5000/api";

let cachedToken = "";
let tokenExpiresAt = 0;
let tokenPromise = null;

export const getAuthToken = () => (
  cachedToken && tokenExpiresAt > Date.now() ? cachedToken : ""
);

async function ensureTestingToken() {
  if (cachedToken && tokenExpiresAt > Date.now() + 30_000) return cachedToken;
  if (!tokenPromise) {
    tokenPromise = getTestingToken()
      .then((data) => {
        if (!data?.access_token) throw new Error("Unable to authorize with the testing service.");
        cachedToken = data.access_token;
        tokenExpiresAt = Date.now() + Math.max(0, Number(data.expires_in || 0)) * 1000;
        return cachedToken;
      })
      .finally(() => {
        tokenPromise = null;
      });
  }
  return tokenPromise;
}

export const getAuthHeaders = (extraHeaders = {}) => ({
  "Content-Type": "application/json",
  ...extraHeaders,
  ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
});

export const fetchWithAuth = async (endpoint, options = {}) => {
  const base = TESTING_API_BASE.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const normalizedPath = path === "/api" ? "" : path.startsWith("/api/") ? path.slice(4) : path;
  const url = endpoint.startsWith("http") ? endpoint : `${base}${normalizedPath}`;
  try {
    const token = await ensureTestingToken();
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers = {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    return await fetch(url, { ...options, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Unable to connect to testing service at ${base}. ${error?.message || "Network request failed."}`);
    }
    throw error;
  }
};

export async function getTests() { const res = await fetchWithAuth("/tests"); if (!res.ok) throw new Error("Failed to fetch tests"); return res.json(); }
export async function getPublishedTests() { const res = await fetchWithAuth("/tests/published"); if (!res.ok) throw new Error("Failed to fetch published tests"); return res.json(); }
export async function getTestById(id) { const res = await fetchWithAuth(`/tests/${id}`); if (!res.ok) throw new Error("Failed to fetch test details"); return res.json(); }
export async function createTest(testData) { const res = await fetchWithAuth("/tests", { method: "POST", body: JSON.stringify(testData) }); if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Failed to create test"); } return res.json(); }
export async function updateTest(id, testData) { const res = await fetchWithAuth(`/tests/${id}`, { method: "PUT", body: JSON.stringify(testData) }); if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Failed to update test"); } return res.json(); }
export async function deleteTest(id) { const res = await fetchWithAuth(`/tests/${id}`, { method: "DELETE" }); if (!res.ok) throw new Error("Failed to delete test"); return res.json(); }
export async function togglePublishTest(id) { const res = await fetchWithAuth(`/tests/${id}/publish`, { method: "PATCH" }); if (!res.ok) throw new Error("Failed to update test publish status"); return res.json(); }
export async function getQuestions(params = {}) { const searchParams = new URLSearchParams(params).toString(); const res = await fetchWithAuth(`/questions${searchParams ? `?${searchParams}` : ""}`); if (!res.ok) throw new Error("Failed to fetch questions"); return res.json(); }
