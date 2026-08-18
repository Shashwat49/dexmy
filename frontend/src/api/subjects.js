import api from "./client";

export const getSubjects = () =>
  api.get("/subjects").then((r) => r.data);

export const getSubject = (subjectId) =>
  api.get(`/subjects/${subjectId}`).then((r) => r.data);