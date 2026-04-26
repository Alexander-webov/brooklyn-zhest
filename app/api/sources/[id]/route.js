import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { runParser } from '@/parsers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function PATCH(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const allowed = ['name', 'url', 'is_enabled', 'frequency_minutes', 'config'];
  const patch = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  const { data, error } = await admin().from('sources').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}

export async function DELETE(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const { error } = await admin().from('sources').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const url = new URL(req.url);
  if (url.searchParams.get('action') !== 'run') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  const { data: source, error } = await admin().from('sources').select('*').eq('id', id).single();
  if (error || !source) return NextResponse.json({ error: 'source not found' }, { status: 404 });
  try {
    const result = await runParser(source);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
