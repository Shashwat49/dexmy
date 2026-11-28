import assert from "node:assert/strict";
import test from "node:test";
import { getPackagesForSelection } from "./packageSelection.js";

test("filters active plans by currency and explicit subject while keeping legacy plans available", () => {
  const plans = [
    { id: "inr-match", is_active: true, currency: "INR", subject_ids: [12] },
    { id: "inr-other", is_active: true, currency: "INR", subject_ids: [13] },
    { id: "usd-match", is_active: true, currency: "USD", subject_ids: [12] },
    { id: "legacy", is_active: true, currency: "INR", subject_ids: [] },
    { id: "inactive", is_active: false, currency: "INR", subject_ids: [12] },
  ];
  assert.deepEqual(getPackagesForSelection(plans, 12, "INR").map(({ id }) => id), ["inr-match", "legacy"]);
});
