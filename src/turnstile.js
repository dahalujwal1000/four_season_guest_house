/**
 * Spam protection - Cloudflare Turnstile (free, unlimited, invisible).
 *
 * Set TURNSTILE_SECRET_KEY in .env to switch it on. Without keys the site still works:
 * the form falls back to honeypot + time-trap + per-IP rate limit, so you can build
 * and test today and paste the real keys whenever you like.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export function siteKey() {
  return process.env.TURNSTILE_SITE_KEY || '';
}

export async function verifyTurnstile(token, remoteIp) {
  if (!turnstileEnabled()) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: 'missing-token' };
  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {})
    });
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = await res.json();
    return { ok: Boolean(data.success), error: (data['error-codes'] || []).join(',') };
  } catch (err) {
    // Do not punish the guest if Cloudflare is unreachable from the mountains.
    return { ok: true, skipped: true, error: err.message };
  }
}

/* ---------------- rate limiting (in-memory, resets on restart) ---------------- */

const hits = new Map();

export function rateLimit(key, limit = 5, windowMinutes = 10) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfterMinutes: Math.ceil((windowMs - (now - list[0])) / 60000) };
  }
  list.push(now);
  hits.set(key, list);
  return { ok: true, remaining: limit - list.length };
}

export function resetRateLimits() {
  hits.clear();
}

export function resetRateLimit(key) {
  hits.delete(key);
}
