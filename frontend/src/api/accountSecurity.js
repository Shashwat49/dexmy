import api from "./client";

export const requestPasswordRecovery = (email) =>
  api.post("/auth/password/forgot", { email }).then((r) => r.data);
export const resetPassword = (token, new_password) =>
  api.post("/auth/password/reset", { token, new_password }).then((r) => r.data);
export const requestEmailChange = (email, current_password) =>
  api.post("/users/me/email/change", { email, current_password }).then((r) => r.data);
export const confirmEmailChange = (token) =>
  api.post("/users/email/confirm", { token }).then((r) => r.data);
export const changePhoneNumber = (phone, current_password) =>
  api.post("/users/me/phone/change", { phone, current_password }).then((r) => r.data);
