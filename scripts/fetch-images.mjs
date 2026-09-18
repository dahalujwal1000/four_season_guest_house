/**
 * Downloads free-licensed sample imagery used as placeholders across the site.
 * Every image is replaceable 1:1 by the owner's real Chame photos (same filename).
 * Run:  node scripts/fetch-images.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'public', 'images');

const wiki = (file, w = 1800) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${w}`;
const unsplash = (id, w = 1600) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&fm=jpg&fit=crop`;

const TARGETS = [
  // ---- Chame / Annapurna scenery (Wikimedia Commons, free license) ----
  ['annapurna-snow-peaks.jpg', wiki('Annapurna Circuit Snow Mountains.jpg', 2200)],
  ['annapurna-ii.jpg', wiki('Annapurna II seen during Annapurna Circuit Trek.jpg', 2000)],
  ['thorong-la.jpg', wiki('Thorong La Pass, Himalaya, Nepal.jpg', 1600)],
  ['suspension-bridge.jpg', wiki('Suspension bridge, Annapurna, Nepal, Crossing.jpg', 1600)],
  ['circuit-valley.jpg', wiki('Nepal Annapurna circuis (48020315912).jpg', 1800)],
  ['yaks-lake.jpg', wiki('Yaks at small lake - Annapurna Circuit, Nepal - panoramio.jpg', 1600)],
  ['mountain-village.jpg', wiki('Village au-dessus de Gandrung (9300418180).jpg', 1600)],
  ['himalaya-ridge.jpg', wiki('The way of the Mountain.jpg', 1800)],
  // ---- Food (Wikimedia Commons, free license) ----
  ['dal-bhat.jpg', wiki('Nepali dal-bhat-tarkari.jpg', 1400)],
  ['nepali-thali.jpg', wiki('Traditional Nepali Thali.jpg', 1400)],
  // ---- Room / interior placeholders (Unsplash license: free to use) ----
  ['room-twin.jpg', unsplash('photo-1590490360182-c33d57733427')],
  ['room-deluxe.jpg', unsplash('photo-1611892440504-42a792e24d32')],
  ['room-family.jpg', unsplash('photo-1591088398332-8a7791972843')],
  ['room-dorm.jpg', unsplash('photo-1555854877-bab0e564b8d5')],
  ['room-detail.jpg', unsplash('photo-1631049307264-da0ec9d70304')],
  ['room-mountain-view.jpg', unsplash('photo-1618773928121-c32242e63f39')],
  ['restaurant-interior.jpg', unsplash('photo-1517248135467-4c7edcad34c4')],
  ['terrace-dining.jpg', unsplash('photo-1414235077428-338989a2e8c0')],
  ['breakfast.jpg', unsplash('photo-1533089860892-a7c6f0a88666')],
  ['trekker-trail.jpg', unsplash('photo-1551632811-561732d1e306')],
];

async function grab(file, url) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'FourSeasonGuestHouseSite/1.0 (sample image fetch)' },
      redirect: 'follow',
    });
    if (!res.ok) return { file, status: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 12000) return { file, status: `too small (${buf.length}b)` };
    await writeFile(path.join(OUT, file), buf);
    return { file, status: `ok ${(buf.length / 1024).toFixed(0)}kb` };
  } catch (err) {
    return { file, status: `fail ${err.message}` };
  }
}

await mkdir(OUT, { recursive: true });
const results = [];
for (const [file, url] of TARGETS) results.push(await grab(file, url));
for (const r of results) console.log(`${r.status.padEnd(18)} ${r.file}`);
const bad = results.filter((r) => !r.status.startsWith('ok'));
console.log(`\n${results.length - bad.length}/${results.length} downloaded`);
if (bad.length) console.log('missing:', bad.map((b) => b.file).join(', '));