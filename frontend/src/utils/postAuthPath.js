export function getSafePostAuthPath(next) {
  if (next === "/dashboard/student/book") return next;
  if (!next || !next.startsWith("/checkout/package?")) return null;
  try {
    const url = new URL(next, window.location.origin);
    const packageId = url.searchParams.get("package");
    const currency = url.searchParams.get("currency");
    const selectedSubject = url.searchParams.get("subject");
    const subjectQuery = selectedSubject && /^\d+$/.test(selectedSubject)
      ? `&subject=${encodeURIComponent(selectedSubject)}`
      : "";
    return url.origin === window.location.origin && url.pathname === "/checkout/package" && packageId && ["INR", "USD"].includes(currency?.toUpperCase())
      ? `${url.pathname}?package=${encodeURIComponent(packageId)}&currency=${encodeURIComponent(currency.toUpperCase())}${subjectQuery}`
      : null;
  } catch {
    return null;
  }
}
