import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { getChat } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // whitelist
  const allowed = ['name','description','telegram_chat_id','telegram_test_chat_id','test_mode',
    'is_enabled','mode','post_template','min_score','min_interval_minutes','max_per_day',
    'quiet_hours_start','quiet_hours_end','dedup_radius_meters','dedup_window_hours'];
  const patch = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  const { data, error } = await admin().from('channels').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel: data });
}

export async function POST(req, { params }) {
  // action-based: ?action=test_chat
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (action === 'test_chat') {
    const { data: ch } = await admin().from('channels').select('*').eq('id', id).single();
    if (!ch) return NextResponse.json({ error: 'channel not found' }, { status: 404 });
    const target = ch.test_mode ? (ch.telegram_test_chat_id || ch.telegram_chat_id) : ch.telegram_chat_id;
    const result = await getChat(target);
    return NextResponse.json({ result, target });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export async function DELETE(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const { error } = await admin().from('channels').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
