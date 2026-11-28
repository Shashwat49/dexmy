export function getPackagesForSelection(packages, subjectId, currency) {
  return packages.filter((pkg) => {
    if (!pkg.is_active || String(pkg.currency).toUpperCase() !== currency) return false;
    const associatedSubjects = pkg.subject_ids ?? pkg.subjects?.map((subject) => subject.id) ?? [];
    return associatedSubjects.length === 0 || associatedSubjects.some((id) => String(id) === String(subjectId));
  });
}
