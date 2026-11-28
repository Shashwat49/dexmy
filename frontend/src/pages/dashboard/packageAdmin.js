export function packageAdminPayload(form) {
  return {
    ...form,
    class_count: Number(form.class_count),
    price: String(form.price),
    subject_ids: [...new Set((form.subject_ids || []).map(Number))],
  };
}

export function selectedSubjectIds(subjects) {
  return [...new Set((subjects || []).map((subject) => Number(subject.id)))].sort((a, b) => a - b);
}
