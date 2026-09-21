import api from "./client";

export const createPackageCheckout = (payload) => api.post("/payments/packages/checkout", payload).then((r) => r.data);
export const verifyRazorpayPackagePayment = (payload) => api.post("/payments/packages/razorpay/verify", payload).then((r) => r.data);
export const getPackagePaymentHistory = () => api.get("/payments/packages/history").then((r) => r.data);

