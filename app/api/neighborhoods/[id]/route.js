import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const allowed = ['name', 'hashtag', 'keywords', 'center_lat', 'center_lng', 'radius_meters', 'display_order'];
  const patch = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  const { data, error } = await admin().from('neighborhoods').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ neighborhood: data });
}

export async function DELETE(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const { error } = await admin().from('neighborhoods').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
