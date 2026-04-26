import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channel_id');
  let q = admin().from('neighborhoods').select('*').order('display_order');
  if (channelId) q = q.eq('channel_id', channelId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ neighborhoods: data });
}

export async function POST(req) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const required = ['channel_id', 'name', 'hashtag'];
  for (const k of required) if (!body[k]) return NextResponse.json({ error: `${k} is required` }, { status: 400 });
  const { data, error } = await admin().from('neighborhoods').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ neighborhood: data });
}
