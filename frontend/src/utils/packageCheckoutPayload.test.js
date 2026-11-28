import assert from "node:assert/strict";
import test from "node:test";
import { buildPackageCheckoutPayload } from "./packageCheckoutPayload.js";

test("passes the selected subject and locked currency into package checkout", () => {
  assert.deepEqual(buildPackageCheckoutPayload({
    packagePlanId: "plan-42",
    provider: "stripe",
    idempotencyKey: "request-1",
    studentId: "student-1",
    currency: "USD",
    selectedSubjectId: "42",
  }), {
    package_plan_id: "plan-42",
    provider: "stripe",
    idempotency_key: "request-1",
    student_id: "student-1",
    currency: "USD",
    selected_subject_id: "42",
  });
});

test("leaves subject optional for existing checkout links", () => {
  assert.equal(buildPackageCheckoutPayload({
    packagePlanId: "legacy-plan",
    provider: "razorpay",
    idempotencyKey: "request-2",
    studentId: "student-1",
    currency: "INR",
  }).selected_subject_id, null);
});
