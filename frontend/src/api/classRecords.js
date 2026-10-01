import api from "./client";

export const getTeacherClassStudents = () => api.get("/class-records/teacher/students").then((r) => r.data);
export const getTeacherClassRecords = () => api.get("/class-records/teacher").then((r) => r.data);
export const createClassRecord = (payload) => api.post("/class-records/teacher", payload).then((r) => r.data);
export const getMyClassRecords = () => api.get("/class-records/me").then((r) => r.data);
