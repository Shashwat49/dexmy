import api from "./client";

export const signup = (payload) =>
  api.post("/auth/signup", payload).then((r) => r.data);

export const login = (payload) =>
  api.post("/auth/login", payload).then((r) => r.data);

export const refresh = () => api.post("/auth/refresh").then((r) => r.data);

export const logout = () => api.post("/auth/logout").then((r) => r.data);

export const getMe = () => api.get("/users/me").then((r) => r.data);

export const updateMe = (payload) =>
  api.patch("/users/me", payload).then((r) => r.data);
