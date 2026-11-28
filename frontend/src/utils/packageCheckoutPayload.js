export function buildPackageCheckoutPayload({ packagePlanId, provider, idempotencyKey, studentId, currency, selectedSubjectId }) {
  return {
    package_plan_id: packagePlanId,
    provider,
    idempotency_key: idempotencyKey,
    student_id: studentId,
    currency,
    selected_subject_id: selectedSubjectId || null,
  };
}
