# Student package-tab selection: data-model prerequisite

## Decision

The guided subject/course → currency → package flow is not safe to implement against the current catalogue. The public catalogue can list active plans and filter them by `currency`, but there is no plan-to-subject/course relationship with which the UI could accurately filter plans after a subject is selected. Adding a subject picker and then showing the same plans for every selection would imply a restriction that the checkout and package entitlement do not enforce.

No frontend selection flow, backend behavior, database migration, package price, payment/provider processing, or entitlement logic is changed by this note.

## What the current code supports

- `PackagePlan` stores `name`, `class_count`, `price`, `currency`, `is_custom`, and `is_active`. It has no `subject_id`, course identifier, or subject relationship.
- The public package endpoint returns those plan fields. The admin package endpoint and form create and update the same fields; there is no subject/course assignment in admin configuration.
- `Subject` is a separate catalogue. Its current package-related relationship is absent. Existing uses of subjects concern teachers, bookings, and class records, not package plans.
- Checkout receives a package plan ID, fetches that plan, and derives its amount and currency from the plan. The frontend includes a selected currency in the checkout URL and only loads a plan whose currency matches it. Payment-provider selection follows the plan currency.
- The pricing migration defines existing INR and USD rate structures, including the custom row. These should remain authoritative and unchanged. The schema also contains student package entitlements that must remain unaffected.

## Smallest safe follow-up

Add an explicit package-plan-to-subject association (a many-to-many table is the least assumptive shape if plans can cover more than one subject), expose it in the public catalogue, and let administrators assign subjects to plans. Then the student flow can filter actual active plan records by selected subject and selected currency, pass both selections through the checkout URL, and verify the selected plan/currency against current catalogue data before payment. Keep the existing plan IDs, prices, labels, and purchase/credit behavior intact; do not rewrite manually assigned/free packages or existing entitlements. Decide separately whether a purchased entitlement is subject-restricted before changing booking or package-credit behavior.

## Verification boundary

Because no selection behavior can be implemented accurately with the current relationships, selection, currency-filtering-by-subject, selection persistence, and invalid-selection tests must be added with that follow-up rather than testing a nonfunctional UI-only approximation. The existing frontend build and backend test suite can still be run to ensure this documentation-only change is clean.
