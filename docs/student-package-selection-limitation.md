# Student package selection and subject entitlements

## Status

Phases 1–3 are implemented.

- **Phase 1 — Plan/subject association:** `package_plan_subjects` links package plans to the subjects they cover. Admins can assign or clear associations, and the public catalogue returns subject IDs and names.
- **Phase 2 — Guided discovery:** students choose a subject/course, currency, and an eligible package. The selected subject and currency are carried through login and checkout, and checkout validates them against the current plan.
- **Phase 3 — Booking-time enforcement:** after the two free subject demos have been used, booking selects an active package that covers the requested subject and consumes one credit. Credit consumption checks the booking subject again before debiting the package. Cancellation restores the package credit through the existing ledger/refund flow.

## Compatibility rules

- A plan with one or more subject associations is restricted to those subjects.
- A legacy plan with no associated subjects remains unrestricted. This is intentional compatibility behavior, not an inferred subject assignment.
- Free demo classes remain separate from purchased package credits: at most two different subjects can be used for free, and the same subject cannot consume a second free demo.
- Existing package IDs, class counts, prices, currencies, payment providers, and payment activation behavior are unchanged.
- Teacher assignment remains an admin workflow. Student booking does not expose teacher selection.
- Booking and Meet-record lifecycle behavior remains otherwise unchanged.

## Booking behavior

When a student has used the free class for a subject, the booking endpoint selects the earliest-expiring active package with remaining credits whose plan covers that subject. An associated plan that does not include the requested subject is skipped. If no eligible package exists, the API returns HTTP 402 and the student is redirected to the package catalogue with the requested subject preselected.

The package credit is debited in the same database transaction as booking creation and classroom-session creation. If booking creation fails, the debit is rolled back. Cancellation uses the existing idempotent credit-refund ledger operation.

## Concurrency and retry safety

- Booking entitlement checks are serialized with a row lock on the student record, so two simultaneous requests cannot both claim the same free-subject entitlement.
- Client booking requests include a stable idempotency key; retries after a lost response return the existing booking rather than creating a duplicate or charging another credit.
- Idempotency keys are checked against the authenticated student to prevent a key from exposing another student's booking.
- Package selection and debit lock the package row and revalidate remaining credits.

## Verification boundary

The new tests cover subject-restricted package selection, unrestricted legacy-package compatibility, and a second subject check at credit consumption. The existing shared-database booking migration limitation is separate; run the full database-backed suite only against a disposable PostgreSQL database because the current test fixture drops and recreates tables.
