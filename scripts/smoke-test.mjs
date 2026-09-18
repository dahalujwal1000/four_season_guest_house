/**
 * End-to-end smoke test for the Four Seasons Guest House site.
 *
 *   npm test
 *
 * Boots a real server on a spare port with an isolated throwaway data folder,
 * then exercises the public site, the booking engine, the spam guards and the
 * whole admin API. Nothing in your real /data is touched.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4599;
const BASE = `http://127.0.0.1:${PORT}`;
const WORK = mkdtempSync(path.join(tmpdir(), 'fs-smoke-'));

let passed = 0;
let failed = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    console.log(`  \u2717 ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function req(pathname, options = {}) {
  const res = await fetch(BASE + pathname, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html page */ }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, text, json, cookie: setCookie ? setCookie.split(';')[0] : null };
}

function send(method, pathname, body, cookie) {
  return req(pathname, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}
const post = (p, b, c) => send('POST', p, b, c);
const put = (p, b, c) => send('PUT', p, b, c);
const patch = (p, b, c) => send('PATCH', p, b, c);
const del = (p, c) => req(p, { method: 'DELETE', headers: c ? { cookie: c } : {} });

const fillAge = () => Date.now() - 10000;

function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      fetch(`${BASE}/health`)
        .then(() => resolve(true))
        .catch(() => (left <= 0 ? reject(new Error('server did not start')) : setTimeout(() => attempt(left - 1), 250)));
    };
    attempt(retries);
  });
}
async function run() {
  /* ---------------------------- static site ---------------------------- */
  section('Static site');
  for (const page of ['/', '/rooms', '/restaurant', '/gallery', '/guide', '/booking', '/contact', '/admin', '/assets/css/styles.css', '/assets/js/app.js', '/assets/js/admin.js', '/assets/favicon.svg']) {
    const r = await req(page);
    ok(`GET ${page} -> 200`, r.status === 200, `got ${r.status}`);
  }
  const nowhere = await req('/this-page-does-not-exist');
  ok('GET unknown URL -> 404 page', nowhere.status === 404 && /trail leads nowhere/.test(nowhere.text));

  /* ------------------------------ content ------------------------------ */
  section('Content API');
  const content = (await req('/api/content')).json;
  ok('4 room types published', content.roomTypes.length === 4, `got ${content.roomTypes.length}`);
  ok('all 10 rooms in inventory', content.roomTypes.reduce((s, r) => s + r.rooms, 0) === 10);
  ok('menu has 6 sections', content.menu.length === 6, `got ${content.menu.length}`);
  ok('seeded prices present', content.roomTypes.find((r) => r.id === 'twin').price === 1500);
  ok('protection flags exposed', typeof content.protection.turnstileEnabled === 'boolean');
  ok('admin password hash never leaks', !/adminPasswordHash/.test(JSON.stringify(content)));

  /* --------------------------- availability ---------------------------- */
  section('Availability');
  const checkIn = '2026-10-10';
  const checkOut = '2026-10-13';
  const avail = (await req(`/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`)).json;
  ok('3 nights counted', avail.nights === 3, `got ${avail.nights}`);
  ok('every room type reported', avail.rooms.length === 4);
  ok('all rooms free before bookings', avail.rooms.every((r) => r.available));
  ok('dorm bed available for a solo trekker',
    (await req(`/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=1`)).json.rooms.find((r) => r.id === 'dorm').available === true);
  ok('reversed dates rejected with 400', (await req(`/api/availability?checkIn=${checkOut}&checkOut=${checkIn}`)).status === 400);

  /* ----------------------------- booking ------------------------------- */
  section('Booking engine');
  const first = await post('/api/bookings', {
    roomTypeId: 'deluxe', checkIn, checkOut, guests: 2,
    name: 'Smoke Trekker', email: 'smoke@example.com', phone: '+9779800000000',
    country: 'Poland', notes: 'Late arrival', formOpenedAt: fillAge()
  });
  ok('booking accepted with 201', first.status === 201, JSON.stringify(first.json));
  const booking = first.json.booking;
  ok('reference looks like FS-XXXXXX', /^FS-[A-Z0-9]{6}$/.test(booking.code), booking.code);
  ok('total = rate x nights', booking.total === booking.rate * booking.nights, `${booking.total}`);
  ok('booking starts as pending', booking.status === 'pending');
  ok('guest WhatsApp confirm link built', (first.json.whatsappUrl || '').startsWith('https://wa.me/'));
  ok('owner alert link built', (first.json.ownerWhatsappUrl || '').includes(booking.code));

  const looked = (await req(`/api/bookings/${booking.code}`)).json;
  ok('guest can look up the reference', looked.code === booking.code && looked.nights === 3);
  ok('unknown reference -> 404', (await req('/api/bookings/FS-NOPE00')).status === 404);

  const afterOne = (await req(`/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`)).json.rooms.find((r) => r.id === 'deluxe');
  ok('deluxe now 1 of 2 free', afterOne.minAvailable === 1, `got ${afterOne.minAvailable}`);
  const second = await post('/api/bookings', {
    roomTypeId: 'deluxe', checkIn, checkOut, guests: 2,
    name: 'Second Guest', email: 'second@example.com', phone: '+9779800000002', formOpenedAt: fillAge()
  });
  ok('second deluxe booking accepted', second.status === 201, JSON.stringify(second.json));

  const third = await post('/api/bookings', {
    roomTypeId: 'deluxe', checkIn, checkOut, guests: 2,
    name: 'Over Booker', email: 'over@example.com', phone: '+9779800000003', formOpenedAt: fillAge()
  });
  ok('third deluxe booking rejected with 409', third.status === 409, `got ${third.status}`);
  ok('conflict names the full date', Boolean(third.json && third.json.conflictDate));

  const otherType = await post('/api/bookings', {
    roomTypeId: 'twin', checkIn, checkOut, guests: 2,
    name: 'Twin Guest', email: 'twin@example.com', phone: '+9779800000004', formOpenedAt: fillAge()
  });
  ok('a different room type is still bookable', otherType.status === 201);

  section('Spam protection');
  const honeypot = await post('/api/bookings', {
    roomTypeId: 'twin', checkIn: '2026-11-01', checkOut: '2026-11-02',
    name: 'Bot', email: 'bot@spam.com', website: 'http://spam.example', formOpenedAt: fillAge()
  });
  ok('honeypot answers silently with 202', honeypot.status === 202 && honeypot.json.silent === true);
  ok('form filled in under 3s rejected with 429', (await post('/api/bookings', {
    roomTypeId: 'twin', checkIn: '2026-11-01', checkOut: '2026-11-02',
    name: 'Speedy', email: 'fast@example.com', phone: '+9779800000005', formOpenedAt: Date.now()
  })).status === 429);
  ok('invalid email rejected with 400', (await post('/api/bookings', {
    roomTypeId: 'twin', checkIn: '2026-11-01', checkOut: '2026-11-02',
    name: 'No Mail', email: 'not-an-email', phone: '+9779800000006', formOpenedAt: fillAge()
  })).status === 400);

  /* ------------------------------- admin ------------------------------- */
  section('Admin auth');
  ok('admin API locked without a session', (await req('/api/admin/overview')).status === 401);
  ok('wrong password -> 401', (await post('/api/admin/login', { password: 'definitely-wrong' })).status === 401);
  const login = await post('/api/admin/login', { password: process.env.ADMIN_PASSWORD || 'fourseason' });
  ok('default password signs in', login.status === 200 && login.json.ok === true, JSON.stringify(login.json));
  ok('session cookie issued', Boolean(login.cookie));
  const cookie = login.cookie;
  ok('session reports authenticated', (await req('/api/admin/session', { headers: { cookie } })).json.authenticated === true);
  ok('admin data needs the session', (await req('/api/admin/bookings')).status === 401);
/* ---------------------------- admin panel ---------------------------- */
  section('Admin dashboard and bookings');
  const overview = (await req('/api/admin/overview', { headers: { cookie } })).json;
  ok('overview counts pending bookings', overview.counters.pending === 3, `got ${overview.counters.pending}`);
  ok('inventory total is 10 rooms', overview.counters.totalRooms === 10);
  ok('booked value tracked', overview.counters.bookedValue > 0);
  ok('next 7 nights grid returned', overview.next7.length === 7);
  ok('pending list includes our booking', overview.pendingList.some((b) => b.code === booking.code));

  const pending = (await req('/api/admin/bookings?status=pending', { headers: { cookie } })).json;
  ok('status filter works', pending.bookings.every((b) => b.status === 'pending') && pending.total >= 2);
  const search = (await req('/api/admin/bookings?q=Smoke%20Trekker', { headers: { cookie } })).json;
  ok('search by guest name works', search.bookings.length === 1 && search.bookings[0].code === booking.code);

  const confirmed = await patch(`/api/admin/bookings/${booking.id}`, { status: 'confirmed' }, cookie);
  ok('status can be set to confirmed', confirmed.status === 200 && confirmed.json.booking.status === 'confirmed');
  ok('unknown status rejected', (await patch(`/api/admin/bookings/${booking.id}`, { status: 'nonsense' }, cookie)).status === 400);

  const walkIn = await post('/api/admin/bookings', {
    roomTypeId: 'twin', checkIn: '2026-12-01', checkOut: '2026-12-03',
    name: 'Walk-in Guest', phone: '+9779800000001', guests: 2, status: 'confirmed'
  }, cookie);
  ok('walk-in booking created', walkIn.status === 201 && walkIn.json.booking.source === 'admin', JSON.stringify(walkIn.json));

  section('Admin calendar and blocks');
  const cal = (await req('/api/admin/calendar?from=2026-10-08&days=8', { headers: { cookie } })).json;
  ok('calendar returns every room type', cal.roomTypes.length === 4);
  ok('calendar shows 8 days per room', cal.roomTypes[0].cells.length === 8);
  const deluxeCell = cal.roomTypes.find((r) => r.id === 'deluxe').cells.find((c) => c.date === checkIn);
  ok('calendar marks the booked nights', deluxeCell.occupied === 2, `occupied ${deluxeCell.occupied}`);
  ok('calendar computes free rooms', deluxeCell.free === 0);

  const block = await post('/api/admin/blocks', { roomTypeId: 'family', dateFrom: '2026-10-20', dateTo: '2026-10-22', reason: 'Maintenance' }, cookie);
  ok('block created', block.status === 201);
  const blocked = (await req('/api/availability?checkIn=2026-10-20&checkOut=2026-10-22&guests=3')).json.rooms.find((r) => r.id === 'family');
  ok('blocked family room shows as unavailable', blocked.available === false && blocked.minAvailable === 0);
  ok('block removed', (await del(`/api/admin/blocks/${block.json.block.id}`, cookie)).status === 200);
  const freed = (await req('/api/availability?checkIn=2026-10-20&checkOut=2026-10-22&guests=3')).json.rooms.find((r) => r.id === 'family');
  ok('family room free again after unblocking', freed.available === true);
  section('Admin content editing');
  const roomEdit = await put('/api/admin/rooms', { rooms: [{ id: 'twin', price: 1600, rooms: 6, capacity: 2, blurb: 'Updated blurb' }] }, cookie);
  ok('room price saved', roomEdit.status === 200 && roomEdit.json.roomTypes.find((r) => r.id === 'twin').price === 1600);
  ok('new price is live on the public site', (await req('/api/content')).json.roomTypes.find((r) => r.id === 'twin').price === 1600);
  ok('inventory still totals 10 rooms', (await req('/api/admin/overview', { headers: { cookie } })).json.counters.totalRooms === 10);
  await put('/api/admin/rooms', { rooms: [{ id: 'twin', price: 1500 }] }, cookie);

  const settings = await put('/api/admin/settings', { settings: { phone: '+977-69440011', ownerEmail: 'owner@fourseasonschame.com' } }, cookie);
  ok('contact details saved', settings.status === 200 && settings.json.settings.phone === '+977-69440011');
  ok('public site shows the new phone', (await req('/api/content')).json.settings.phone === '+977-69440011');

  const menu = await put('/api/admin/settings', { settings: { menu: [{ section: 'Smoke Section', items: [['Test Dish', 123, 'Only for the test']] }] } }, cookie);
  ok('menu saved', menu.status === 200 && menu.json.menu.length === 1);
  ok('new menu is public', (await req('/api/content')).json.menu[0].items[0][1] === 123);

  const reviews = await put('/api/admin/reviews', {
    reviews: [{ name: 'Anna K', country: 'Poland', rating: 5, text: 'Best hot shower on the circuit.', date: '2026-04-18' }]
  }, cookie);
  ok('review saved', reviews.status === 200 && reviews.json.reviews.length === 1);
  ok('rating clamped to 1-5', (await put('/api/admin/reviews', { reviews: [{ name: 'X', rating: 99, text: 'ok' }] }, cookie)).json.reviews[0].rating === 5);

  section('Messages, log and password');
  const inquiry = await post('/api/inquiries', {
    name: 'Marie', email: 'marie@example.fr', phone: '+33600000000',
    message: 'Is the family room free on 15 October for four people?', formOpenedAt: fillAge()
  });
  ok('contact form accepted', inquiry.status === 201 && inquiry.json.ok === true);
  ok('too-short message rejected', (await post('/api/inquiries', { name: 'Bob', email: 'bob@example.com', message: 'hi', formOpenedAt: fillAge() })).status === 400);

  const inquiries = (await req('/api/admin/inquiries', { headers: { cookie } })).json;
  ok('admin sees the message', inquiries.inquiries.length === 1 && inquiries.inquiries[0].name === 'Marie');
  const log = (await req('/api/admin/notifications', { headers: { cookie } })).json;
  ok('booking log captured every event', log.notifications.length >= 4, `${log.notifications.length} entries`);
  ok('inquiry deleted', (await del(`/api/admin/inquiries/${inquiries.inquiries[0].id}`, cookie)).status === 200);
  ok('log cleared', (await del('/api/admin/notifications', cookie)).status === 200);

  const old = process.env.ADMIN_PASSWORD || 'fourseason';
  ok('short new password rejected', (await post('/api/admin/password', { currentPassword: old, newPassword: 'abc' }, cookie)).status === 400);
  ok('wrong current password rejected', (await post('/api/admin/password', { currentPassword: 'nope', newPassword: 'chame2026' }, cookie)).status === 400);
  ok('password changed', (await post('/api/admin/password', { currentPassword: old, newPassword: 'chame2026' }, cookie)).status === 200);
  ok('old password no longer works', (await post('/api/admin/login', { password: old })).status === 401);
  const relogin = await post('/api/admin/login', { password: 'chame2026' });
  ok('new password works', relogin.status === 200 && relogin.json.ok === true);
  ok('no firstLogin flag on later logins', relogin.json.firstLogin === undefined);
  ok('walk-in booking deleted', (await del(`/api/admin/bookings/${walkIn.json.booking.id}`, cookie)).status === 200);
  ok('confirmed booking survives in the list', (await req('/api/admin/bookings?status=confirmed', { headers: { cookie } })).json.total >= 1);
}
/* ------------------------------- runner -------------------------------- */
const child = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
  cwd: WORK,
  env: { ...process.env, PORT: String(PORT), ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'fourseason' },
  stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.resume();
child.stderr.resume();

try {
  await waitForServer();
  console.log(`Server up on ${BASE} (throwaway data in ${WORK})`);
  await run();
} catch (err) {
  failed += 1;
  console.log(`\nFatal: ${err.message}`);
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (existsSync(path.join(WORK, 'data', 'db.json'))) console.log('\nDatastore written to data/db.json as expected.');
  try {
    rmSync(WORK, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    console.log('(temporary folder left behind - Windows file lock, harmless)');
  }
}

console.log(`\n${'-'.repeat(52)}`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
