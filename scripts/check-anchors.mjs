/* Dev-only checker: verifies every element the front-end JS looks for exists in the HTML. */
import { readFileSync } from 'node:fs';

const need = {
  'index.html': ['hero__bg', 'hero__meta', 'home-rooms', 'home-reviews', 'home-facilities'],
  'rooms.html': ['rooms-grid'],
  'restaurant.html': ['menu-grid'],
  'gallery.html': ['gallery', 'lightbox'],
  'guide.html': ['main'],
  'booking.html': ['book-form', 'date-step', 'date-error', 'book-results', 'details-panel', 'sum-room', 'sum-dates', 'sum-guests', 'sum-total', 'ts-slot', 'book-error', 'booking-success', 'bk-code', 'bk-summary', 'bk-whatsapp', 'checkIn', 'checkOut', 'guests', 'roomTypeId', 'name', 'email', 'phone', 'country', 'notes', 'website'],
  'contact.html': ['contact-form', 'ts-slot-contact', 'contact-ok', 'contact-err', 'message'],
  'admin.html': ['login-view', 'panel', 'logout', 'login-form', 'login-error', 'default-pw', 'tabs', 'tab-dash', 'tab-bookings', 'tab-calendar', 'tab-rooms', 'tab-content', 'tab-menu', 'tab-reviews', 'tab-messages', 'tab-notifications', 'b-status', 'b-search', 'b-add', 'b-refresh', 'b-walkin', 'b-table', 'cal-from', 'cal-30', 'cal-60', 'cal-grid', 'block-form', 'block-list', 'bl-room', 'bl-from', 'bl-to', 'bl-reason'],
  '404.html': ['main']
};

let failures = 0;

for (const [file, ids] of Object.entries(need)) {
  const html = readFileSync(`public/${file}`, 'utf8');
  const missing = ids.filter((id) => !html.includes(`id="${id}"`) && !html.includes(`name="${id}"`) && !html.includes(id));
  if (missing.length) {
    failures += 1;
    console.log(`MISSING in ${file}: ${missing.join(', ')}`);
  } else {
    console.log(`OK   ${file} (${ids.length} anchors)`);
  }
}

const gallery = readFileSync('public/gallery.html', 'utf8');
if (!gallery.includes('lightbox__close')) { failures += 1; console.log('MISSING .lightbox__close in gallery.html'); }

// Header, footer, WhatsApp button and #yr / #ft-alt are injected by renderChrome() in app.js.
const appJs = readFileSync('public/assets/js/app.js', 'utf8');
for (const token of ['site-header', 'site-footer', 'brand__mark', 'nav__toggle', 'id="yr"', 'id="ft-alt"', 'data-c-maps']) {
  if (!appJs.includes(token)) { failures += 1; console.log(`MISSING ${token} in app.js renderChrome()`); }
}

const index = readFileSync('public/index.html', 'utf8');
if (!/action="\/booking"/.test(index)) { failures += 1; console.log('MISSING quick-book form action in index.html'); }

console.log(failures ? `FAILED: ${failures} problem(s)` : 'ALL PAGE ANCHORS PRESENT');
process.exit(failures ? 1 : 0);
