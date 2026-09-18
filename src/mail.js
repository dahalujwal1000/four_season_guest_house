/**
 * Booking notifications - free on both sides.
 *
 *  1. Every notification is always appended to data/notifications.log (admin can read it in the panel).
 *  2. If RESEND_API_KEY + MAIL_FROM are set, the same text is emailed via Resend's free tier
 *     (100 emails/day - far more than 10 rooms need). No SDK, just fetch().
 *  3. Guests get a one-tap WhatsApp confirmation link built from settings.whatsapp (wa.me, free).
 */
import { appendFile } from 'node:fs/promises';
import path from 'node:path';

const LOG_FILE = path.join(process.cwd(), 'data', 'notifications.log');

export function money(amount, currency = 'NPR') {
  return `${currency} ${Number(amount || 0).toLocaleString('en-US')}`;
}

export function nightsWord(n) {
  return `${n} night${n === 1 ? '' : 's'}`;
}

export function buildGuestMessage(booking, roomType, settings) {
  return [
    `Namaste ${booking.name}!`,
    '',
    `Your booking request at ${settings.name} is received.`,
    `Reference: ${booking.code}`,
    `Room: ${roomType ? roomType.name : booking.roomTypeId}`,
    `Check-in: ${booking.checkIn} from ${settings.checkIn}`,
    `Check-out: ${booking.checkOut} by ${settings.checkOut}`,
    `Guests: ${booking.guests}`,
    `Estimated total: ${money(booking.total, settings.currency)}`,
    '',
    `We will confirm on WhatsApp / email shortly. ${settings.address}`,
    settings.phone
  ].join('\n');
}

export function whatsappLink(phoneNumber, message) {
  const digits = String(phoneNumber || '').replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

async function emailViaResend(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from || !to) return { skipped: true };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text })
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Sends one notification to the lodge and optionally one to the guest.
 * Always resolves - a notification failure must never lose a booking.
 */
export async function notify({ kind, subject, text, guestEmail, ownerEmail }) {
  const stamp = new Date().toISOString();
  const entry = { id: `${Date.now()}`, kind, at: stamp, subject, text, guestEmail: guestEmail || null };
  try {
    await appendFile(LOG_FILE, `\n[${stamp}] ${kind.toUpperCase()} :: ${subject}\n${text}\n${'-'.repeat(60)}\n`, 'utf8');
  } catch { /* logging is best-effort */ }

  const emailed = [];
  if (ownerEmail) emailed.push({ to: ownerEmail, ...(await emailViaResend(ownerEmail, `[Four Seasons] ${subject}`, text)) });
  if (guestEmail) emailed.push({ to: guestEmail, ...(await emailViaResend(guestEmail, `Your booking at Four Seasons Guest House`, text)) });

  return { entry, emailed };
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}
