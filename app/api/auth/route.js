import { NextResponse } from 'next/server';
import { checkPassword, createSession, destroySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'login';

  if (action === 'logout') {
    await destroySession();
    return NextResponse.json({ ok: true });
  }

  // login
  const { password } = await req.json().catch(() => ({}));
  if (!password) return NextResponse.json({ error: 'password is required' }, { status: 400 });
  if (!checkPassword(password)) {
    // small delay to slow down brute force a bit
    await new Promise(r => setTimeout(r, 600));
    return NextResponse.json({ error: 'неверный пароль' }, { status: 401 });
  }
  await createSession();
  return NextResponse.json({ ok: true });
}
