import api from "./client";

export const getMyStudentProfile = () => api.get("/students/me/profile").then((r) => r.data);
export const updateMyStudentProfile = (payload) => api.patch("/students/me/profile", payload).then((r) => r.data);
