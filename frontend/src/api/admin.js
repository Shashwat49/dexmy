import api from "./client";

export const getAdminMe = () => api.get("/admin/me");
export const getDashboardMetrics = () => api.get("/admin/dashboard/metrics");
export const getAdminStudents = (params = {}) => api.get("/admin/students", { params });
export const getAdminTeachers = (params = {}) => api.get("/admin/teachers", { params });
export const getAdminBookings = (params = {}) => api.get("/admin/bookings", { params });
export const getPackages = (includeInactive = false) => api.get("/admin/packages", { params: { include_inactive: includeInactive } });
export const getFinanceSummary = () => api.get("/admin/finance/summary");
export const getPayouts = (params = {}) => api.get("/admin/payouts", { params });
export const getPayoutAccounts = (params = {}) => api.get("/admin/payouts/accounts", { params });
