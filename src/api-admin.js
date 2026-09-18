/**
 * Admin API - the whole back office for the lodge owner.
 * One password login, signed session cookie, no paid auth service.
 */
import { db, mutate, newId } from './db.js';
import { calendarGrid, isValidRange, nightsBetween, iso, toDate, addDays } from './availability.js';
import { createSessionCookie, clearSessionCookie, isAuthenticated, hashPassword, verifyPassword } from './auth.js';
import { emailConfigured } from './mail.js';
import { sendJson, readBody, unauthorized, notFound, badRequest, clean, toInt, isEmail } from './http.js';

const DEFAULT_PASSWORD = () => process.env.ADMIN_PASSWORD || 'fourseason';

/* ------------------------------- overview ------------------------------- */

function overview(data) {
  const today = iso(new Date());
  const active = data.bookings.filter((b) => ['pending', 'confirmed', 'checked-in'].includes(b.status));
  const tonight = active.filter((b) => b.checkIn <= today && b.checkOut > today);
  const totalRooms = data.roomTypes.reduce((sum, r) => sum + r.rooms, 0);
  const next7 = [];
  for (let i = 0; i < 7; i += 1) {
    const date = iso(addDays(toDate(today), i));
    const staying = active.filter((b) => b.checkIn <= date && b.checkOut > date).length;
    next7.push({
      date,
      occupancy: staying,
      total: totalRooms,
      percent: totalRooms ? Math.round((staying / totalRooms) * 100) : 0
    });
  }
  return {
    today,
    counters: {
      pending: data.bookings.filter((b) => b.status === 'pending').length,
      confirmed: data.bookings.filter((b) => b.status === 'confirmed').length,
      checkedIn: data.bookings.filter((b) => b.status === 'checked-in').length,
      roomsOccupiedTonight: tonight.length,
      totalRooms,
      inquiries: (data.inquiries || []).length,
      bookedValue: data.bookings.filter((b) => b.status !== 'cancelled').reduce((sum, b) => sum + b.total, 0)
    },
    arrivals: active.filter((b) => b.checkIn === today),
    departures: active.filter((b) => b.checkOut === today),
    upcoming: active
      .filter((b) => b.checkIn > today)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .slice(0, 8),
    pendingList: data.bookings.filter((b) => b.status === 'pending').slice(0, 8),
    next7,
    emailConfigured: emailConfigured()
  };
}


/* --------------------------------- login --------------------------------- */

async function login(req, res) {
  const body = await readBody(req);
  const data = await db();
  const password = clean(body.password, 200);
  if (!password) return sendJson(res, 400, { error: 'Please enter the password.' });

  const stored = data.settings.adminPasswordHash;
  if (!stored) {
    // First ever login: accept ADMIN_PASSWORD (or the built-in default) and store its hash.
    if (password !== DEFAULT_PASSWORD()) return sendJson(res, 401, { error: 'Wrong password.' });
    await mutate((d) => {
      d.settings.adminPasswordHash = hashPassword(password);
    });
    return sendJson(res, 200, { ok: true, firstLogin: true }, { 'set-cookie': createSessionCookie() });
  }
  if (!verifyPassword(password, stored)) return sendJson(res, 401, { error: 'Wrong password.' });
  return sendJson(res, 200, { ok: true }, { 'set-cookie': createSessionCookie() });
}

/* -------------------------------- router -------------------------------- */

export async function handleAdmin(req, res, url) {
  const { pathname } = url;

  if (pathname === '/api/admin/login' && req.method === 'POST') return login(req, res);
  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    return sendJson(res, 200, { ok: true }, { 'set-cookie': clearSessionCookie() });
  }
  if (pathname === '/api/admin/session' && req.method === 'GET') {
    const data = await db();
    return sendJson(res, 200, {
      authenticated: isAuthenticated(req),
      usesDefaultPassword: !data.settings.adminPasswordHash
    });
  }

  if (!isAuthenticated(req)) throw unauthorized('Please sign in again.');
  const data = await db();

  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    return sendJson(res, 200, overview(data));
  }

  if (pathname === '/api/admin/bookings' && req.method === 'GET') {
    const status = clean(url.searchParams.get('status'), 20);
    const query = clean(url.searchParams.get('q'), 80).toLowerCase();
    let list = [...data.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (status && status !== 'all') list = list.filter((b) => b.status === status);
    if (query) {
      list = list.filter((b) =>
        [b.code, b.name, b.email, b.phone, b.roomTypeName].join(' ').toLowerCase().includes(query)
      );
    }
    return sendJson(res, 200, { bookings: list, total: list.length });
  }

  if (pathname === '/api/admin/bookings' && req.method === 'POST') {
    const body = await readBody(req);
    const roomType = data.roomTypes.find((r) => r.id === clean(body.roomTypeId, 40));
    if (!roomType) throw notFound('Unknown room type.');
    const checkIn = clean(body.checkIn, 10);
    const checkOut = clean(body.checkOut, 10);
    if (!isValidRange(checkIn, checkOut)) throw badRequest('Choose valid dates for the walk-in booking.');
    const nights = nightsBetween(checkIn, checkOut).length;
    const rate = toInt(body.rate, roomType.price);
    const booking = {
      id: newId(),
      code: clean(body.code, 20).toUpperCase() || `FS-WALK${Math.floor(Math.random() * 900 + 100)}`,
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      checkIn,
      checkOut,
      nights,
      guests: Math.max(1, toInt(body.guests, 2)),
      name: clean(body.name, 120) || 'Walk-in guest',
      email: clean(body.email, 160),
      phone: clean(body.phone, 40),
      country: clean(body.country, 80),
      notes: clean(body.notes, 1000),
      rate,
      total: rate * nights,
      status: clean(body.status, 20) || 'confirmed',
      source: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await mutate((d) => d.bookings.push(booking));
    return sendJson(res, 201, { ok: true, booking });
  }
async function handleBookingAction(req, res, url, data) {
  const { pathname } = url;
  const statuses = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'];

  const bookingRoute = pathname.match(/^\/api\/admin\/bookings\/([\w-]+)$/);
  if (bookingRoute) {
    const id = bookingRoute[1];
    const booking = data.bookings.find((b) => b.id === id);
    if (!booking) throw notFound('Booking not found.');

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      if (body.status && !statuses.includes(body.status)) throw badRequest('Unknown status.');
      await mutate((d) => {
        const target = d.bookings.find((b) => b.id === id);
        if (body.status) target.status = body.status;
        if (body.notes !== undefined) target.notes = clean(body.notes, 1000);
        if (body.rate !== undefined) {
          target.rate = Math.max(0, toInt(body.rate, target.rate));
          target.total = target.rate * target.nights;
        }
        target.updatedAt = new Date().toISOString();
      });
      const updated = (await db()).bookings.find((b) => b.id === id);
      return sendJson(res, 200, { ok: true, booking: updated });
    }

    if (req.method === 'DELETE') {
      await mutate((d) => {
        d.bookings = d.bookings.filter((b) => b.id !== id);
      });
      return sendJson(res, 200, { ok: true });
    }
  }

  if (pathname === '/api/admin/calendar' && req.method === 'GET') {
    const from = clean(url.searchParams.get('from'), 10) || iso(new Date());
    const days = Math.min(Math.max(toInt(url.searchParams.get('days'), 31), 7), 60);
    return sendJson(res, 200, calendarGrid(data, from, days));
  }

  if (pathname === '/api/admin/rooms' && req.method === 'PUT') {
    const body = await readBody(req);
    const updates = Array.isArray(body.rooms) ? body.rooms : [];
    await mutate((d) => {
      for (const patch of updates) {
        const room = d.roomTypes.find((r) => r.id === patch.id);
        if (!room) continue;
        if (patch.price !== undefined) room.price = Math.max(0, toInt(patch.price, room.price));
        if (patch.rooms !== undefined) room.rooms = Math.max(0, toInt(patch.rooms, room.rooms));
        if (patch.capacity !== undefined) room.capacity = Math.max(1, toInt(patch.capacity, room.capacity));
        if (patch.name) room.name = clean(patch.name, 80);
        if (patch.blurb) room.blurb = clean(patch.blurb, 400);
      }
    });
    return sendJson(res, 200, { ok: true, roomTypes: (await db()).roomTypes });
  }

  if (pathname === '/api/admin/blocks' && req.method === 'GET') {
    return sendJson(res, 200, { blocks: data.blocks });
  }

  if (pathname === '/api/admin/blocks' && req.method === 'POST') {
    const body = await readBody(req);
    const roomType = data.roomTypes.find((r) => r.id === clean(body.roomTypeId, 40));
    if (!roomType) throw notFound('Unknown room type.');
    const dateFrom = clean(body.dateFrom, 10);
    const dateTo = clean(body.dateTo, 10);
    if (!isValidRange(dateFrom, dateTo)) throw badRequest('Choose a valid date range to block.');
    const block = {
      id: newId(),
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      dateFrom,
      dateTo,
      reason: clean(body.reason, 200) || 'Blocked by owner',
      createdAt: new Date().toISOString()
    };
    await mutate((d) => d.blocks.push(block));
    return sendJson(res, 201, { ok: true, block });
  }

  const blockRoute = pathname.match(/^\/api\/admin\/blocks\/([\w-]+)$/);
  if (blockRoute && req.method === 'DELETE') {
    await mutate((d) => {
      d.blocks = d.blocks.filter((b) => b.id !== blockRoute[1]);
    });
    return sendJson(res, 200, { ok: true });
  }

  return handleSettings(req, res, url, data);
}

  return handleBookingAction(req, res, url, data);
}

async function handleSettings(req, res, url, data) {
  const { pathname } = url;

  if (pathname === '/api/admin/settings' && req.method === 'GET') {
    return sendJson(res, 200, {
      settings: data.settings,
      roomTypes: data.roomTypes,
      reviews: data.reviews,
      notificationCount: (data.notifications || []).length,
      inquiryCount: (data.inquiries || []).length,
      blockCount: (data.blocks || []).length
    });
  }

  if (pathname === '/api/admin/settings' && req.method === 'PUT') {
    const body = await readBody(req);
    const patch = body.settings || {};
    await mutate((d) => {
      const s = d.settings;
      const textFields = [
        'name', 'shortName', 'tagline', 'intro', 'phone', 'whatsapp', 'email', 'address',
        'plusCode', 'mapsUrl', 'mapEmbed', 'altitude', 'checkIn', 'checkOut', 'currency', 'ownerEmail'
      ];
      for (const field of textFields) {
        if (patch[field] !== undefined) s[field] = clean(patch[field], 1500);
      }
      if (patch.googleRating !== undefined) s.googleRating = Number(patch.googleRating) || 0;
      if (patch.googleReviewCount !== undefined) s.googleReviewCount = toInt(patch.googleReviewCount, 0);
      if (Array.isArray(patch.facilities)) {
        s.facilities = patch.facilities.slice(0, 24).map((f) => ({
          icon: clean(f.icon, 20),
          title: clean(f.title, 80),
          text: clean(f.text, 300)
        }));
      }
      if (Array.isArray(patch.policies)) {
        s.policies = patch.policies.slice(0, 24).map((p) => ({
          label: clean(p.label, 60),
          value: clean(p.value, 400)
        }));
      }
      if (Array.isArray(patch.menu)) {
        d.menu = patch.menu.slice(0, 40).map((section) => ({
          section: clean(section.section, 80),
          items: (section.items || []).slice(0, 80).map((item) => [
            clean(item[0], 120),
            toInt(item[1], 0),
            clean(item[2], 300)
          ])
        }));
      }
    });
    return sendJson(res, 200, { ok: true, settings: (await db()).settings, menu: (await db()).menu });
  }

  if (pathname === '/api/admin/password' && req.method === 'POST') {
    const body = await readBody(req);
    const current = clean(body.currentPassword, 200);
    const next = clean(body.newPassword, 200);
    if (!verifyPassword(current, data.settings.adminPasswordHash)) throw badRequest('Current password is wrong.');
    if (next.length < 6) throw badRequest('New password must be at least 6 characters.');
    await mutate((d) => {
      d.settings.adminPasswordHash = hashPassword(next);
    });
    return sendJson(res, 200, { ok: true, message: 'Password updated.' });
  }

  if (pathname === '/api/admin/reviews' && req.method === 'PUT') {
    const body = await readBody(req);
    const list = Array.isArray(body.reviews) ? body.reviews : [];
    await mutate((d) => {
      d.reviews = list.slice(0, 40).map((r) => ({
        name: clean(r.name, 80) || 'Guest',
        country: clean(r.country, 60),
        rating: Math.min(Math.max(toInt(r.rating, 5), 1), 5),
        text: clean(r.text, 800),
        date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : iso(new Date())
      }));
    });
    return sendJson(res, 200, { ok: true, reviews: (await db()).reviews });
  }

  if (pathname === '/api/admin/notifications' && req.method === 'GET') {
    const list = [...(data.notifications || [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
    return sendJson(res, 200, { notifications: list });
  }

  if (pathname === '/api/admin/notifications' && req.method === 'DELETE') {
    await mutate((d) => {
      d.notifications = [];
    });
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/admin/inquiries' && req.method === 'GET') {
    const list = [...(data.inquiries || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, { inquiries: list });
  }

  const inquiryRoute = pathname.match(/^\/api\/admin\/inquiries\/([\w-]+)$/);
  if (inquiryRoute && req.method === 'DELETE') {
    await mutate((d) => {
      d.inquiries = d.inquiries.filter((i) => i.id !== inquiryRoute[1]);
    });
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Unknown admin route' });
}