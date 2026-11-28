import assert from "node:assert/strict";
import test from "node:test";
import { getSafePostAuthPath } from "./postAuthPath.js";

globalThis.window = { location: { origin: "https://dexmy.test" } };

test("preserves supported local purchase and demo routes", () => {
  assert.equal(getSafePostAuthPath("/dashboard/student/book"), "/dashboard/student/book");
  assert.equal(
    getSafePostAuthPath("/checkout/package?package=plan-1&currency=usd"),
    "/checkout/package?package=plan-1&currency=USD",
  );
});

test("rejects external, incomplete, and unrelated redirects", () => {
  assert.equal(getSafePostAuthPath("https://evil.test/"), null);
  assert.equal(getSafePostAuthPath("//evil.test/checkout/package?package=x&currency=USD"), null);
  assert.equal(getSafePostAuthPath("/checkout/package?package=x"), null);
  assert.equal(getSafePostAuthPath("/dashboard/admin"), null);
});
