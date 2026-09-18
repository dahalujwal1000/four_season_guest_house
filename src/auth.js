/**
 * Admin authentication: scrypt password hash + HMAC-signed session cookie.
 * Free, dependency-free, no third-party auth service.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const COOKIE = 'fs_admin';
const SESSION_HOURS = 12;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt:')) return false;
  const [, salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const dir = path.join(process.cwd(), 'data');
  const file = path.join(dir, 'session-secret.txt');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, secret, 'utf8');
  return secret;
}

function sign(value) {
  return createHmac('sha256', sessionSecret()).update(value).digest('hex');
}

export function createSessionCookie() {
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = String(expires);
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isAuthenticated(req) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return false;
  const token = match.slice(COOKIE.length + 1);
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  return Number(payload) > Date.now();
}