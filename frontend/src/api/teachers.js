import api from "./client";

export const getMyTeacherProfile = () =>
  api
    .get("/teachers/me/profile")
    .then((r) => r.data);


export const updateMyTeacherProfile = (payload) =>
  api
    .patch("/teachers/me/profile", payload)
    .then((r) => r.data);


export const getMyAvailability = () =>
  api
    .get("/teachers/me/availability")
    .then((r) => r.data);


export const addAvailability = (payload) =>
  api
    .post("/teachers/me/availability", payload)
    .then((r) => r.data);


export const deleteAvailability = (availabilityId) =>
  api
    .delete(`/teachers/me/availability/${availabilityId}`)
    .then((r) => r.data);