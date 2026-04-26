import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { renderPost, sendMessage } from '@/lib/telegram';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { incident_id, force_test } = await req.json().catch(() => ({}));
  if (!incident_id) return NextResponse.json({ error: 'incident_id required' }, { status: 400 });

  const sb = admin();
  const { data: incident, error } = await sb.from('incidents')
    .select('*, channels(*), neighborhoods(name, hashtag), raw_incident_ids')
    .eq('id', incident_id).single();
  if (error || !incident) return NextResponse.json({ error: 'incident not found' }, { status: 404 });

  const ch = incident.channels;
  const targetTest = !!force_test || !!ch.test_mode;
  const target = targetTest ? (ch.telegram_test_chat_id || ch.telegram_chat_id) : ch.telegram_chat_id;
  if (!target) return NextResponse.json({ error: 'no chat_id configured' }, { status: 400 });

  let sourceName = 'Источник';
  if (incident.raw_incident_ids?.length) {
    const { data: raw } = await sb.from('raw_incidents')
      .select('sources(name)')
      .eq('id', incident.raw_incident_ids[0])
      .maybeSingle();
    sourceName = raw?.sources?.name || sourceName;
  }

  const text = renderPost({
    template: ch.post_template,
    incident,
    neighborhood: incident.neighborhoods,
    sourceName
  });

  try {
    const sent = await sendMessage({ chat_id: target, text });
    const message_id = sent?.message_id;

    // Always mark as published — the is_test flag in publish_log records whether
    // this went to the real channel or not. UI used to keep "approved" status
    // forever in test mode which was confusing — now status reflects reality.
    await sb.from('incidents').update({
      status: 'published',
      telegram_message_id: message_id,
      published_at: new Date().toISOString()
    }).eq('id', incident.id);

    await sb.from('publish_log').insert({
      channel_id: ch.id,
      incident_id: incident.id,
      telegram_message_id: message_id,
      is_test: targetTest
    });

    await logInfo({ scope: 'publisher', channel_id: ch.id,
      message: `manual post incident=${incident.id} test=${targetTest}` });

    return NextResponse.json({ ok: true, message_id, target, test: targetTest });
  } catch (e) {
    const err = String(e?.message || e);
    await logError({ scope: 'publisher', channel_id: ch.id, message: 'manual send failed', data: { err }});
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
