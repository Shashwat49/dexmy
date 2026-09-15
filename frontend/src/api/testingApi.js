// Centralized API client for Testing Service with Dexmy JWT authentication bridge
export const TESTING_API_BASE =
  import.meta.env.VITE_TESTING_API_BASE_URL ||
  import.meta.env.VITE_TESTING_API_URL ||
  "http://localhost:5000/api";

/**
 * Returns Authorization header with Dexmy JWT token
 */
export const getAuthToken = () => {
  return (
    localStorage.getItem("dexmy_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("teacherToken") ||
    ""
  );
};

export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
};

export const fetchWithAuth = async (endpoint, options = {}) => {
  const base = TESTING_API_BASE.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http") ? endpoint : `${base}${path}`;
  const headers = getAuthHeaders(options.headers);
  const response = await fetch(url, { ...options, headers });
  return response;
};

// ==========================================
// TEST CREATOR & TEST MANAGEMENT APIS
// ==========================================

export async function getTests() {
  const res = await fetchWithAuth("/tests");
  if (!res.ok) throw new Error("Failed to fetch tests");
  return res.json();
}

export async function getPublishedTests() {
  const res = await fetchWithAuth("/tests/published");
  if (!res.ok) throw new Error("Failed to fetch published tests");
  return res.json();
}

export async function getTestById(id) {
  const res = await fetchWithAuth(`/tests/${id}`);
  if (!res.ok) throw new Error("Failed to fetch test details");
  return res.json();
}

export async function createTest(testData) {
  const res = await fetchWithAuth("/tests", {
    method: "POST",
    body: JSON.stringify(testData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create test");
  }
  return res.json();
}

export async function updateTest(id, testData) {
  const res = await fetchWithAuth(`/tests/${id}`, {
    method: "PUT",
    body: JSON.stringify(testData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update test");
  }
  return res.json();
}

export async function deleteTest(id) {
  const res = await fetchWithAuth(`/tests/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete test");
  return res.json();
}

export async function togglePublishTest(id, isPublished) {
  const endpoint = isPublished ? `/tests/${id}/publish` : `/tests/${id}/unpublish`;
  const res = await fetchWithAuth(endpoint, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error("Failed to update test publish status");
  return res.json();
}

// ==========================================
// QUESTION MANAGEMENT APIS
// ==========================================

export async function getQuestions(params = {}) {
  const searchParams = new URLSearchParams(params).toString();
  const res = await fetchWithAuth(`/questions${searchParams ? `?${searchParams}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch questions");
  return res.json();
}

export async function createQuestion(questionData) {
  const res = await fetchWithAuth("/questions", {
    method: "POST",
    body: JSON.stringify(questionData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create question");
  }
  return res.json();
}

export async function updateQuestion(id, questionData) {
  const res = await fetchWithAuth(`/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(questionData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update question");
  }
  return res.json();
}

export async function deleteQuestion(id) {
  const res = await fetchWithAuth(`/questions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete question");
  return res.json();
}

// ==========================================
// STUDENT TESTING & SUBMISSIONS
// ==========================================

export async function purchaseTest(testId) {
  const res = await fetchWithAuth(`/tests/${testId}/purchase`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Purchase failed");
  }
  return res.json();
}

export async function getMyPurchases() {
  const res = await fetchWithAuth("/tests/my-purchases");
  if (!res.ok) throw new Error("Failed to fetch purchases");
  return res.json();
}

export async function submitTestAttempt(payload) {
  const res = await fetchWithAuth("/test-submissions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to submit test");
  }
  return res.json();
}

export async function getMySubmissions() {
  const res = await fetchWithAuth("/test-submissions/my-submissions");
  if (!res.ok) throw new Error("Failed to fetch submissions");
  return res.json();
}

export async function getTestSubmissions(testId) {
  const res = await fetchWithAuth(`/test-submissions/test/${testId}`);
  if (!res.ok) throw new Error("Failed to fetch test submissions");
  return res.json();
}

export async function reportQuestion(payload) {
  const res = await fetchWithAuth("/question-reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to submit report");
  }
  return res.json();
}
