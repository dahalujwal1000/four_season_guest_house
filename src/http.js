/** Small HTTP helpers shared by the API routes. */

export function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

export function sendText(res, status, text, extraHeaders = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...extraHeaders });
  res.end(text);
}

/** Reads and JSON-parses the request body with a hard size cap. */
export function readBody(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (process.env.TRUST_PROXY === 'true' && typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function unauthorized(message = 'Not authorised') {
  return Object.assign(new Error(message), { status: 401 });
}

export function notFound(message = 'Not found') {
  return Object.assign(new Error(message), { status: 404 });
}

/** Keeps only safe, trimmed string values from guest input. */
export function clean(value, maxLength = 500) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value || '').trim());
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

export function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
