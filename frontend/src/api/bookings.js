import api from "./client";

export const getMyBookings = () =>
  api
    .get("/bookings/me")
    .then((r) => r.data);


export const getAvailableSlots = (
  subjectId
) =>
  api
    .get("/bookings/available-slots", {
      params: {
        subject_id: subjectId,
      },
    })
    .then((r) => r.data);


export const createBooking = (
  subjectId,
  scheduledAt
) =>
  api
    .post("/bookings", {
      subject_id: subjectId,
      scheduled_at: scheduledAt,
    })
    .then((r) => r.data);


export const getBookingSession = (
  bookingId
) =>
  api
    .get(`/bookings/${bookingId}/session`)
    .then((r) => r.data);


export const cancelBooking = (
  bookingId
) =>
  api
    .patch(`/bookings/${bookingId}/cancel`)
    .then((r) => r.data);