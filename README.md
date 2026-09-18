# Four Season Guest House & Restaurant — Chame, Annapurna Circuit

Complete booking website for the guest house: public site, booking engine with
live availability, and an admin panel. Zero dependencies, zero cost to run.

## Run it

```bash
npm start
```

Open http://localhost:4173

On first start the server creates `data/db.json` and seeds it
with the 10 rooms, the restaurant menu, rooms/facilities/gallery content and a
sample review. To start over, stop the server and delete the `data` folder.

## Test it

```bash
npm test
```

Runs the full smoke test (99 checks) against a temporary server and datastore:
site pages, API, booking flow, availability calendar, admin auth + every admin
endpoint. It cleans up after itself and never touches `data/`.

## What's inside

| Path | What it is |
|---|---|
| `public/` | All pages: index, rooms, restaurant, gallery, guide, booking, contact, admin |
| `public/assets/js/app.js` | Frontend logic for the public site |
| `public/assets/js/admin.js` | Frontend logic for the admin panel |
| `public/assets/css/styles.css` | Design system (modern minimal, white, premium) |
| `public/images/` | Downloaded sample photos (replace with real lodge photos) |
| `src/server.js` | Static file server + API routing + .env loading |
| `src/api-public.js` | Rooms, availability, bookings, inquiries, reviews, content |
| `src/api-admin.js` | Admin: login, bookings, calendar, rooms, menu, content, messages |
| `src/db.js` | Atomic, serialized JSON datastore |
| `src/availability.js` | Nightly room-count availability engine |
| `src/turnstile.js` | Cloudflare Turnstile verify + honeypot/time-trap/rate-limit |
| `src/mail.js` | Email via Resend API (optional) + notification log |
| `src/seed.js`, `src/seed-catalog.js` | Database schema + demo data |
| `scripts/smoke-test.mjs` | The 87-check test suite |

## Requirements

- Node.js 20+
- No build step, no dependencies

## Configure

Copy `.env.example` to `.env` before the first admin login.

- `ADMIN_PASSWORD` — required for the first admin login; use at least 10 characters
- `SESSION_SECRET` — recommended in production so sessions survive clean deployments
- `PORT` — HTTP port, default `4173`
- `BUSINESS_TIMEZONE` — booking date timezone, default `Asia/Kathmandu`
- `COOKIE_SECURE=true` — send admin cookies only over HTTPS
- `TRUST_PROXY=true` — use forwarded client IPs when deployed behind a trusted proxy
- `RESEND_API_KEY` + `MAIL_FROM` — booking confirmation emails (free tier,
  100/day). Without it bookings still work; owner gets WhatsApp + log entries.
- `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` — free spam protection from
  dash.cloudflare.com > Turnstile. Without it the honeypot + time-trap +
  rate-limit still protect the forms.

## Admin panel

Go to http://localhost:4173/admin and log in with `ADMIN_PASSWORD`.

- **Dashboard** — occupancy, arrivals, pending booking requests
- **Bookings** — confirm / cancel / check-in / delete, guest details
- **Calendar** — month view of every room, block dates manually
- **Rooms** — prices, counts, photos, descriptions
- **Content** — site texts, phone/WhatsApp, facilities, gallery
- **Menu** — restaurant dishes and prices
- **Reviews** — approve or delete guest reviews
- **Messages** — contact inquiries + notification log

## Where things live

- Datastore file: `data/db.json`
- Email/notification log: `data/notifications.log`
- Website photos: `public/images/`

## Going live

Any Node 20+ host works (VPS, Railway, Render, Fly.io). Set the env vars from
`.env.example` in the host dashboard and point the domain. Replace the sample
photos in `public/images/` with real lodge photos before launch.
