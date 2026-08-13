import api from "./client";

export const signup = (payload) => api.post("/auth/signup", payload).then((r) => r.data);

export const login = (payload) => api.post("/auth/login", payload).then((r) => r.data);

export const getMe = () => api.get("/users/me").then((r) => r.data);
