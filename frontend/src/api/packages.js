import api from "./client";

export const getPackages = () => api.get("/packages").then((r) => r.data);
