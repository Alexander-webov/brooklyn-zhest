import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'bw_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (>= 16 chars required)');
  }
  return s;
}

function sign(payload) {
  const secret = getSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  // constant-time compare
  if (sig.length !== expected.length) return null;
  let ok = 0;
  for (let i = 0; i < sig.length; i++) ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (ok !== 0) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Server: check the cookie and return payload or null. */
export async function getSession() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  return verify(token);
}

export async function requireSession() {
  const s = await getSession();
  if (!s) {
    throw new Error('UNAUTHORIZED');
  }
  return s;
}

/** Server action: create the session cookie after a successful password check. */
export async function createSession(user = 'admin') {
  const c = await cookies();
  const token = sign({ user, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS
  });
}

export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  return ok === 0;
}
