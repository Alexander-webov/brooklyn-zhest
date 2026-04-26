import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { verifyCron } from '@/lib/cron-auth';
import { renderPost, sendMessage } from '@/lib/telegram';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = admin();

  // load enabled channels
  const { data: channels } = await sb.from('channels').select('*').eq('is_enabled', true);
  if (!channels?.length) return NextResponse.json({ ok: true, posted: 0 });

  const now = new Date();
  const nyHour = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', hour12: false
  }).format(now), 10);

  let totalPosted = 0;
  const detail = [];

  for (const ch of channels) {
    // quiet hours check (NY time)
    if (ch.quiet_hours_start != null && ch.quiet_hours_end != null) {
      const inQuiet = ch.quiet_hours_start < ch.quiet_hours_end
        ? (nyHour >= ch.quiet_hours_start && nyHour < ch.quiet_hours_end)
        : (nyHour >= ch.quiet_hours_start || nyHour < ch.quiet_hours_end);
      if (inQuiet) {
        detail.push({ channel: ch.slug, skipped: 'quiet_hours' });
        continue;
      }
    }

    // rate limiting: posts in last `min_interval_minutes` and last 24h
    const since = new Date(Date.now() - ch.min_interval_minutes * 60_000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

    const { count: recent } = await sb.from('publish_log')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', ch.id)
      .gte('published_at', since);

    if ((recent || 0) > 0) {
      detail.push({ channel: ch.slug, skipped: 'rate_limit_interval' });
      continue;
    }

    const { count: dayCount } = await sb.from('publish_log')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', ch.id)
      .gte('published_at', dayAgo);

    if ((dayCount || 0) >= ch.max_per_day) {
      detail.push({ channel: ch.slug, skipped: 'daily_cap' });
      continue;
    }

    // pick the next approved incident, prioritized by score then age
    const { data: candidates } = await sb.from('incidents')
      .select('*, neighborhoods(name, hashtag), raw_incident_ids')
      .eq('channel_id', ch.id)
      .eq('status', 'approved')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (!candidates?.length) {
      detail.push({ channel: ch.slug, skipped: 'no_approved' });
      continue;
    }

    const incident = candidates[0];

    // figure out source name from one of the raw rows
    let sourceName = 'NYPD/Reddit';
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

    const targetChat = ch.test_mode ? (ch.telegram_test_chat_id || ch.telegram_chat_id) : ch.telegram_chat_id;
    if (!targetChat) {
      detail.push({ channel: ch.slug, skipped: 'no_chat_id' });
      continue;
    }

    try {
      const sent = await sendMessage({ chat_id: targetChat, text });
      const messageId = sent?.message_id;

      await sb.from('incidents').update({
        status: 'published',
        telegram_message_id: messageId,
        published_at: new Date().toISOString()
      }).eq('id', incident.id);

      await sb.from('publish_log').insert({
        channel_id: ch.id,
        incident_id: incident.id,
        telegram_message_id: messageId,
        is_test: !!ch.test_mode
      });

      totalPosted++;
      detail.push({ channel: ch.slug, posted: incident.id, test: !!ch.test_mode });

      await logInfo({ scope: 'publisher', channel_id: ch.id,
        message: `posted incident ${incident.id} to ${targetChat}`, data: { test: ch.test_mode } });
    } catch (e) {
      const err = String(e?.message || e).slice(0, 500);
      await sb.from('publish_log').insert({
        channel_id: ch.id,
        incident_id: incident.id,
        is_test: !!ch.test_mode,
        error: err
      });
      await logError({ scope: 'publisher', channel_id: ch.id,
        message: 'send failed', data: { incident_id: incident.id, err } });
      detail.push({ channel: ch.slug, error: err });
    }
  }

  return NextResponse.json({ ok: true, posted: totalPosted, detail });
}

export const POST = GET;
