import api from "./client";

export const getStudentProfile = () =>
  api.get("/profiles/student").then((r) => r.data);

export const updateStudentProfile = (payload) =>
  api.patch("/profiles/student", payload).then((r) => r.data);

export const getTeacherProfile = () =>
  api.get("/profiles/teacher").then((r) => r.data);

export const updateTeacherProfile = (payload) =>
  api.patch("/profiles/teacher", payload).then((r) => r.data);