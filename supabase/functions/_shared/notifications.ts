// Shared helpers for notification edge functions.
// Centralizes phone normalization, business-hours gating, and WhatsApp sending.

/**
 * Normalize a Brazilian phone number to canonical form: 13 digits.
 * Format: 55 (country) + DDD (2) + 9 (nono dígito) + 8 digits subscriber.
 *
 * Accepts inputs in any format (with/without country code, with/without nono dígito,
 * with/without separators) and returns a single canonical 13-digit string.
 *
 * Returns null when the input cannot be confidently normalized.
 */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let n = String(raw).replace(/\D/g, "");
  if (!n) return null;

  // Strip leading country code 55 if present (so we work with national format)
  if (n.length >= 12 && n.startsWith("55")) {
    n = n.slice(2);
  }

  // n should now be either:
  //  - 10 digits: DDD(2) + 8-digit number (legacy, missing nono dígito)
  //  - 11 digits: DDD(2) + 9-digit number (current standard for mobile)
  if (n.length === 10) {
    // Insert the "9" after DDD to upgrade to 11-digit standard
    n = n.slice(0, 2) + "9" + n.slice(2);
  }

  if (n.length !== 11) return null; // can't normalize confidently

  // DDD must be 2 digits, mobile number should start with 9
  // If it doesn't (landline edge case), still return as-is prepended with 55
  return "55" + n;
}

/**
 * Compare two phone numbers by their canonical form.
 */
export function phoneEqualsBR(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = normalizePhoneBR(a);
  const cb = normalizePhoneBR(b);
  if (!ca || !cb) return false;
  return ca === cb;
}

/**
 * Returns true if the current time is within Brazilian business hours (BRT/UTC-3):
 *  - Mon–Fri: 08:30–18:00
 *  - Sat:     08:00–12:00
 *  - Sun:     closed
 */
export function isBusinessHoursBRT(now: Date = new Date()): boolean {
  const brt = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
  const dow = brt.getDay();
  const totalMin = brt.getHours() * 60 + brt.getMinutes();
  if (dow === 0) return false;
  if (dow === 6) return totalMin >= 480 && totalMin < 720;
  return totalMin >= 510 && totalMin < 1080;
}

export interface ZapiConfig {
  instance_id: string;
  token: string;
  client_token?: string | null;
}

/**
 * Send a plain WhatsApp text message via Z-API.
 * Normalizes the destination phone before sending.
 * Returns { ok, status, body } for logging.
 */
export async function sendWhatsAppText(
  zapi: ZapiConfig,
  phone: string,
  message: string,
): Promise<{ ok: boolean; status: number; body: any }> {
  const normalized = normalizePhoneBR(phone) ?? String(phone).replace(/\D/g, "");
  const url = `https://api.z-api.io/instances/${zapi.instance_id}/token/${zapi.token}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (zapi.client_token) headers["Client-Token"] = zapi.client_token;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: normalized, message }),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (e: any) {
    return { ok: false, status: 0, body: { error: e?.message ?? String(e) } };
  }
}

/**
 * Insert an in-app notification only if no equivalent one was created in the last `dedupeMinutes`.
 * Equivalence = same (user_id, title, message).
 */
export async function insertNotificationDedup(
  supabase: any,
  payload: { user_id: string; title: string; message: string; link?: string | null },
  dedupeMinutes = 360,
): Promise<{ inserted: boolean }> {
  const since = new Date(Date.now() - dedupeMinutes * 60_000).toISOString();
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", payload.user_id)
    .eq("title", payload.title)
    .eq("message", payload.message)
    .gte("created_at", since)
    .limit(1);
  if (existing && existing.length > 0) return { inserted: false };
  await supabase.from("notifications").insert({
    user_id: payload.user_id,
    title: payload.title,
    message: payload.message,
    link: payload.link ?? null,
  });
  return { inserted: true };
}
