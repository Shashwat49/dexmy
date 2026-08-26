import api from "./client";

export const getLinkedStudents = () =>
  api.get("/parents/me/students").then((r) => r.data);

export const linkStudent = (studentEmail) =>
  api
    .post("/parents/me/students", {
      student_email: studentEmail,
    })
    .then((r) => r.data);

export const getStudentBookings = (studentId) =>
  api
    .get(`/parents/me/students/${studentId}/bookings`)
    .then((r) => r.data);

export const unlinkStudent = (studentId) =>
  api.delete(`/parents/me/students/${studentId}`).then((r) => r.data);
