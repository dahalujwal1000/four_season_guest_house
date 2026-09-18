/**
 * Public API: site content, live availability, bookings and inquiries.
 */
import { db, mutate, newId, newBookingCode } from './db.js';
import { availabilityFor, isValidRange, nightsBetween, occupiedOn, occupancyMap } from './availability.js';
import { verifyTurnstile, rateLimit, turnstileEnabled, siteKey } from './turnstile.js';
import { notify, buildGuestMessage, whatsappLink, money, nightsWord, emailConfigured } from './mail.js';
import { sendJson, readBody, clientIp, badRequest, notFound, clean, isEmail, toInt } from './http.js';

const MIN_FILL_SECONDS = 3;

export function publicContent(data) {
  return {
    settings: data.settings,
    roomTypes: [...data.roomTypes].sort((a, b) => a.sort - b.sort),
    menu: data.menu,
    reviews: data.reviews,
    protection: { turnstileEnabled: turnstileEnabled(), siteKey: siteKey(), emailConfigured: emailConfigured() }
  };
}

export async function handlePublic(req, res, url) {
  const { pathname } = url;

  if (pathname === '/api/content' && req.method === 'GET') {
    const data = await db();
    return sendJson(res, 200, publicContent(data));
  }

  if (pathname === '/api/availability' && req.method === 'GET') {
    const checkIn = clean(url.searchParams.get('checkIn'), 10);
    const checkOut = clean(url.searchParams.get('checkOut'), 10);
    const guests = toInt(url.searchParams.get('guests'), 2);
    if (!isValidRange(checkIn, checkOut)) {
      return sendJson(res, 400, { error: 'Please choose a valid check-in and check-out date (max 30 nights).' });
    }
    const data = await db();
    const nights = nightsBetween(checkIn, checkOut);
    return sendJson(res, 200, {
      checkIn,
      checkOut,
      guests,
      nights: nights.length,
      rooms: availabilityFor(data, checkIn, checkOut, guests)
    });
  }

  if (pathname === '/api/bookings' && req.method === 'POST') {
    return createBooking(req, res);
  }

  const lookup = pathname.match(/^\/api\/bookings\/([A-Za-z0-9-]+)$/);
  if (lookup && req.method === 'GET') {
    const code = lookup[1].toUpperCase();
    const data = await db();
    const booking = data.bookings.find((b) => b.code.toUpperCase() === code);
    if (!booking) throw notFound('We could not find that booking reference.');
    return sendJson(res, 200, {
      code: booking.code,
      status: booking.status,
      roomTypeName: booking.roomTypeName,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      guests: booking.guests,
      name: booking.name,
      total: booking.total,
      rate: booking.rate
    });
  }

  if (pathname === '/api/inquiries' && req.method === 'POST') {
    return createInquiry(req, res);
  }

  return sendJson(res, 404, { error: 'Unknown API route' });
}

/** Honeypot + time-trap + rate limit. Returns null when the request may continue. */
function spamGuard(res, body, ip, bucket) {
  if (clean(body.website, 100)) {
    sendJson(res, 202, { ok: true, silent: true });
    return true;
  }
  const openedAt = toInt(body.formOpenedAt, 0);
  if (openedAt && (Date.now() - openedAt) / 1000 < MIN_FILL_SECONDS) {
    sendJson(res, 429, { error: 'That was too quick - please try again.' });
    return true;
  }
  const limit = rateLimit(`${bucket}:${ip}`, 5, 10);
  if (!limit.ok) {
    sendJson(res, 429, {
      error: `Too many requests. Please try again in about ${limit.retryAfterMinutes} minute(s) or message us on WhatsApp.`
    });
    return true;
  }
  return false;
}

async function createBooking(req, res) {
  const body = await readBody(req);
  const ip = clientIp(req);
  if (spamGuard(res, body, ip, 'booking')) return;

  const capture = await verifyTurnstile(clean(body.turnstileToken, 2048), ip);
  if (!capture.ok) return sendJson(res, 400, { error: 'Verification failed. Please refresh the page and try again.' });

  const data = await db();
  const roomTypeId = clean(body.roomTypeId, 40);
  const roomType = data.roomTypes.find((r) => r.id === roomTypeId);
  if (!roomType) return sendJson(res, 400, { error: 'Please choose a room type.' });

  const checkIn = clean(body.checkIn, 10);
  const checkOut = clean(body.checkOut, 10);
  if (!isValidRange(checkIn, checkOut)) return sendJson(res, 400, { error: 'Please choose valid dates (max 30 nights).' });

  const guests = Math.max(1, Math.min(toInt(body.guests, 2), 20));
  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const phone = clean(body.phone, 40);
  const country = clean(body.country, 80);
  const notes = clean(body.notes, 1000);
  if (name.length < 2) return sendJson(res, 400, { error: 'Please tell us your name.' });
  if (!isEmail(email)) return sendJson(res, 400, { error: 'Please enter a valid email address.' });
  if (phone.replace(/[^\d]/g, '').length < 6) {
    return sendJson(res, 400, { error: 'Please enter a phone or WhatsApp number we can reach you on.' });
  }

  // Never trust the browser: re-check availability on the server.
  const map = occupancyMap(data);
  const nights = nightsBetween(checkIn, checkOut);
  const full = nights.find((night) => occupiedOn(map, roomTypeId, night) >= roomType.rooms);
  if (full) {
    return sendJson(res, 409, {
      error: `${roomType.name} is fully booked on ${full}. Please pick another room type or shift your dates.`,
      conflictDate: full
    });
  }

  const now = new Date().toISOString();
  const booking = {
    id: newId(),
    code: newBookingCode(),
    roomTypeId,
    roomTypeName: roomType.name,
    checkIn,
    checkOut,
    nights: nights.length,
    guests,
    name,
    email,
    phone,
    country,
    notes,
    rate: roomType.price,
    total: roomType.price * nights.length,
    status: 'pending',
    source: 'website',
    createdAt: now,
    updatedAt: now
  };

  const summary = `${name} (${email}, ${phone}${country ? `, ${country}` : ''})\n${roomType.name}: ${checkIn} to ${checkOut} (${nightsWord(nights.length)}), ${guests} guest(s)\nTotal: ${money(booking.total, data.settings.currency)}\nNotes: ${notes || '-'}`;

  await mutate((d) => {
    d.bookings.push(booking);
    d.notifications.push({
      id: booking.id,
      kind: 'booking',
      at: now,
      subject: `Booking request ${booking.code} - ${roomType.name} (${nights.length} nights)`,
      text: summary,
      guestEmail: email
    });
  });

  const guestMessage = buildGuestMessage(booking, roomType, data.settings);
  const delivery = await notify({
    kind: 'booking',
    subject: `New booking ${booking.code} - ${roomType.name}, ${checkIn}`,
    text: summary,
    guestEmail: email,
    ownerEmail: data.settings.ownerEmail
  });

  return sendJson(res, 201, {
    ok: true,
    booking,
    guestMessage,
    whatsappUrl: whatsappLink(data.settings.whatsapp, guestMessage),
    ownerWhatsappUrl: whatsappLink(
      data.settings.whatsapp,
      `New booking ${booking.code}: ${name}, ${roomType.name}, ${checkIn} to ${checkOut}, ${guests} guest(s). Phone: ${phone}`
    ),
    emailed: (delivery.emailed || []).filter((e) => e.to === email).some((e) => e.ok)
  });
}

async function createInquiry(req, res) {
  const body = await readBody(req);
  const ip = clientIp(req);
  if (spamGuard(res, body, ip, 'inquiry')) return;

  const capture = await verifyTurnstile(clean(body.turnstileToken, 2048), ip);
  if (!capture.ok) return sendJson(res, 400, { error: 'Verification failed. Please refresh and try again.' });

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const message = clean(body.message, 2000);
  if (name.length < 2) throw badRequest('Please tell us your name.');
  if (!isEmail(email)) throw badRequest('Please enter a valid email address.');
  if (message.length < 5) throw badRequest('Please write a short message.');

  const data = await db();
  const inquiry = { id: newId(), name, email, phone: clean(body.phone, 40), message, createdAt: new Date().toISOString() };
  await mutate((d) => {
    d.inquiries.push(inquiry);
    d.notifications.push({
      id: inquiry.id,
      kind: 'inquiry',
      at: inquiry.createdAt,
      subject: `Message from ${name}`,
      text: `${name} (${email}, ${inquiry.phone || '-'})\n\n${message}`,
      guestEmail: email
    });
  });
  await notify({
    kind: 'inquiry',
    subject: `Website message from ${name}`,
    text: `${name} (${email})\n\n${message}`,
    ownerEmail: data.settings.ownerEmail
  });
  return sendJson(res, 201, { ok: true, message: 'Thank you - your message is with us. We usually reply within a day.' });
}
