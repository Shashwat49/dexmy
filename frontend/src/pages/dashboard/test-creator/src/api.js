// Re-export centralized Testing API client for test-creator components
export {
  TESTING_API_BASE as API_BASE,
  getAuthToken,
  getAuthHeaders,
  fetchWithAuth,
} from "../../../../api/testingApi";
