import api from "./client";

export const getApiHealth = () =>
  api.get("/system/health").then((response) => response.data);

export const getApiVersion = () =>
  api.get("/system/version").then((response) => response.data);