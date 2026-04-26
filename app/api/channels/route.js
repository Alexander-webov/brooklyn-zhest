import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await admin().from('channels').select('*').order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channels: data });
}

export async function POST(req) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const required = ['slug', 'name', 'telegram_chat_id'];
  for (const k of required) if (!body[k]) return NextResponse.json({ error: `${k} is required` }, { status: 400 });
  const { data, error } = await admin().from('channels').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel: data });
}
