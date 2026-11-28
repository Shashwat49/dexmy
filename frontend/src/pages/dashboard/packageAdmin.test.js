import test from "node:test";
import assert from "node:assert/strict";
import { packageAdminPayload, selectedSubjectIds } from "./packageAdmin.js";

test("package admin payload sends unique numeric subject identifiers and retains pricing", () => {
  assert.deepEqual(packageAdminPayload({
    name: "Plan",
    class_count: "25",
    price: "4999.00",
    currency: "INR",
    subject_ids: ["12", 4, "12"],
  }), {
    name: "Plan",
    class_count: 25,
    price: "4999.00",
    currency: "INR",
    subject_ids: [12, 4],
  });
});

test("legacy plans without subject data remain unassigned and editable", () => {
  assert.deepEqual(selectedSubjectIds(undefined), []);
  assert.deepEqual(packageAdminPayload({ name: "Legacy", class_count: 25, price: "0", currency: "USD" }).subject_ids, []);
});

test("editing a plan uses its assigned subjects independent of API order", () => {
  assert.deepEqual(selectedSubjectIds([{ id: 9 }, { id: 2 }, { id: 9 }]), [2, 9]);
});
