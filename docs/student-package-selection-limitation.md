# Student package-tab selection: Phase 1 data-model foundation

## Status

Phase 1 adds an optional many-to-many association between package plans and subjects. Administrators can assign or remove subjects through the existing package API and admin form, and the public catalogue returns each plan's `subject_ids` and subject `{id, name}` records. The additive migration creates only the association table; it does not assign subjects to existing plans or change plan records, entitlements, pricing, checkout, or payment behavior. Plans with no associations remain valid. Student-facing subject selection is intentionally out of scope.

## Why student selection remains deferred

The guided subject/course → currency → package flow can now use an explicit plan-to-subject relationship, but Phase 1 does not add student-facing selection, enforce subject restrictions during checkout or bookings, or change entitlement behavior. That follow-up must filter real active plan records by subject and currency and validate the chosen plan before payment; an empty association remains unrestricted rather than guessed.

Phase 1 does not change package prices, currency logic, checkout, payment providers, or entitlements.

## What Phase 1 supports

- `PackagePlan` has an optional many-to-many relationship with `Subject` through `package_plan_subjects`.
- The public package endpoint keeps its existing fields and adds `subject_ids` and `subjects` (`id` and `name`). An empty association is returned for unassigned plans and remains valid for catalogue and checkout.
- The admin package endpoint and form create, replace, and clear subject assignments. IDs are validated against existing subjects; omitting `subject_ids` on update leaves assignments unchanged.
- Existing plan IDs, names, INR/USD pricing and currency logic, free/manual packages, package credits, bookings, class records, classroom behavior, checkout, and payment providers remain unchanged.

## Next phase

The guided subject/course → currency → package student flow must filter active plans using the explicit association and selected currency, and checkout validation must use current catalogue data. Decide separately whether a purchased entitlement is subject-restricted before changing booking or package-credit behavior.

## Verification boundary

Phase 1 does not implement student selection, selection persistence, filtering by subject, or subject enforcement in checkout, bookings, or entitlements.
