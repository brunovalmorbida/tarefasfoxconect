/**
 * Normalize a Brazilian phone number to canonical form: 13 digits.
 * Format: 55 (country) + DDD (2) + 9 (nono dígito) + 8 digits subscriber.
 * Returns null when the input cannot be confidently normalized.
 */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let n = String(raw).replace(/\D/g, "");
  if (!n) return null;
  if (n.length >= 12 && n.startsWith("55")) n = n.slice(2);
  if (n.length === 10) n = n.slice(0, 2) + "9" + n.slice(2);
  if (n.length !== 11) return null;
  return "55" + n;
}

/**
 * Format a stored (possibly canonical) BR phone into "(54) 99922-3558" for display.
 * Falls back to the raw value when normalization fails.
 */
export function formatPhoneBR(raw: string | null | undefined): string {
  if (!raw) return "";
  const norm = normalizePhoneBR(raw);
  if (!norm) return String(raw);
  // norm = 55 + DDD(2) + 9 + 8 digits
  const ddd = norm.slice(2, 4);
  const part1 = norm.slice(4, 9);
  const part2 = norm.slice(9, 13);
  return `(${ddd}) ${part1}-${part2}`;
}
