/**
 * Tiny JSON datastore. No dependencies, no build step, no database server.
 * Writes are atomic (temp file + rename) so a power cut in Chame cannot corrupt the data.
 */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createSeed } from './seed.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let cache = null;
let writeQueue = Promise.resolve();

async function ensureLoaded() {
  if (cache) return cache;
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DB_FILE, 'utf8');
    cache = JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    cache = createSeed();
    await save();
  }
  return cache;
}

export async function db() {
  return ensureLoaded();
}

async function persist() {
  const tmp = `${DB_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2), 'utf8');
  await rename(tmp, DB_FILE);
}

function enqueue(operation) {
  const queued = writeQueue.then(operation);
  writeQueue = queued.catch(() => {});
  return queued;
}

export async function save() {
  return enqueue(persist);
}

/** Read-modify-write helper: `await mutate(d => { d.bookings.push(x) })` */
export async function mutate(fn) {
  await ensureLoaded();
  return enqueue(async () => {
    const result = await fn(cache);
    await persist();
    return result;
  });
}

export const paths = { DATA_DIR, DB_FILE };

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Booking reference shown to the guest, e.g. FS-4K7QM2 */
export function newBookingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `FS-${out}`;
}
