import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { verifyCron } from '@/lib/cron-auth';
import { processRawIncident } from '@/lib/groq';
import { geocode, matchNeighborhood } from '@/lib/geocoder';
import { findDuplicate } from '@/lib/dedup';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 8; // process at most this many per run; controls Groq RPM

export async function GET(req) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = admin();

  // load pending raws (with source + channel info)
  const { data: pending, error } = await sb
    .from('raw_incidents')
    .select('*, sources(name, channel_id), channels:channel_id(*)')
    .eq('processing_status', 'pending')
    .order('fetched_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pending?.length) return NextResponse.json({ ok: true, processed: 0 });

  // group by channel: load neighborhoods, recent incidents, channel settings once per channel
  const channelIds = [...new Set(pending.map(r => r.channel_id))];

  const neighborhoodsByChannel = {};
  const recentByChannel = {};
  const channelById = {};
  for (const cid of channelIds) {
    const [{ data: nh }, { data: rec }, { data: ch }] = await Promise.all([
      sb.from('neighborhoods').select('*').eq('channel_id', cid),
      sb.from('incidents')
        .select('id,channel_id,type,address,body_ru,latitude,longitude,occurred_at,created_at,status')
        .eq('channel_id', cid)
        .neq('status', 'rejected')
        .gte('created_at', new Date(Date.now() - 8 * 3600_000).toISOString()),
      sb.from('channels').select('*').eq('id', cid).single()
    ]);
    neighborhoodsByChannel[cid] = nh || [];
    recentByChannel[cid] = rec || [];
    channelById[cid] = ch;
  }

  const results = [];

  for (const raw of pending) {
    try {
      // mark in-flight
      await sb.from('raw_incidents').update({ processing_status: 'processing' }).eq('id', raw.id);

      const llm = await processRawIncident({
        source_name: raw.sources?.name,
        url: raw.raw_url,
        published_at: raw.raw_published_at,
        title: raw.raw_title,
        body: raw.raw_body
      });

      if (!llm.relevant) {
        await sb.from('raw_incidents').update({
          processing_status: 'rejected',
          processed_at: new Date().toISOString(),
          processing_error: llm.reason_if_irrelevant?.slice(0, 500) || 'irrelevant'
        }).eq('id', raw.id);
        results.push({ id: raw.id, status: 'rejected', reason: llm.reason_if_irrelevant });
        continue;
      }

      // stop-word filter
      const channel = channelById[raw.channel_id];
      const { data: filters } = await sb.from('filters')
        .select('*').eq('channel_id', raw.channel_id).eq('is_active', true);

      const haystack = `${llm.title_ru} ${llm.body_ru}`.toLowerCase();
      const stopHit = (filters || []).find(f =>
        f.type === 'stopword' && haystack.includes(f.value.toLowerCase())
      );
      const blacklistHit = (filters || []).find(f =>
        f.type === 'blacklist_type' && f.value.toLowerCase() === llm.type.toLowerCase()
      );
      if (stopHit || blacklistHit) {
        await sb.from('raw_incidents').update({
          processing_status: 'rejected',
          processed_at: new Date().toISOString(),
          processing_error: stopHit ? `stopword:${stopHit.value}` : `blacklist:${blacklistHit.value}`
        }).eq('id', raw.id);
        results.push({ id: raw.id, status: 'filtered' });
        continue;
      }

      // geocoding (best-effort, don't fail the whole pipeline if it dies)
      let geo = null;
      if (llm.address) {
        geo = await geocode(llm.address);
      }

      const neighborhood = matchNeighborhood({
        address: llm.address,
        lat: geo?.lat,
        lng: geo?.lng
      }, neighborhoodsByChannel[raw.channel_id]);

      const incidentDraft = {
        channel_id: raw.channel_id,
        raw_incident_ids: [raw.id],
        type: llm.type || 'other',
        title_ru: llm.title_ru,
        body_ru: llm.body_ru,
        address: llm.address,
        landmark: llm.landmark,
        neighborhood_id: neighborhood?.id || null,
        latitude: geo?.lat || null,
        longitude: geo?.lng || null,
        occurred_at: llm.occurred_at || raw.raw_published_at,
        score: typeof llm.score === 'number' ? llm.score : 50,
        status: 'pending'
      };

      // dedup
      const dup = findDuplicate(incidentDraft, recentByChannel[raw.channel_id], {
        radius_meters: channel.dedup_radius_meters,
        window_hours: channel.dedup_window_hours
      });

      let incidentId;
      if (dup) {
        // merge: append raw_id, bump score if new info, keep survivor's status
        const merged = await sb.from('incidents').update({
          raw_incident_ids: Array.from(new Set([...(dup.raw_incident_ids || []), raw.id])),
          score: Math.max(dup.score || 0, incidentDraft.score)
        }).eq('id', dup.id).select().single();
        incidentId = dup.id;
      } else {
        // auto-approve under hybrid/auto mode if score high enough
        if (channel.mode === 'auto') {
          incidentDraft.status = incidentDraft.score >= channel.min_score ? 'approved' : 'pending';
        } else if (channel.mode === 'hybrid') {
          incidentDraft.status = incidentDraft.score >= 70 ? 'approved' : 'pending';
        }
        const { data: ins, error: insErr } = await sb.from('incidents').insert(incidentDraft).select('id').single();
        if (insErr) throw insErr;
        incidentId = ins.id;
        recentByChannel[raw.channel_id].push({ ...incidentDraft, id: incidentId, created_at: new Date().toISOString() });
      }

      await sb.from('raw_incidents').update({
        processing_status: 'done',
        processed_at: new Date().toISOString(),
        incident_id: incidentId
      }).eq('id', raw.id);

      results.push({ id: raw.id, status: 'done', incident_id: incidentId, merged: !!dup });
    } catch (e) {
      const msg = String(e?.message || e).slice(0, 500);
      await sb.from('raw_incidents').update({
        processing_status: 'error',
        processing_error: msg
      }).eq('id', raw.id);
      await logError({ scope: 'processor', message: 'process failed', data: { raw_id: raw.id, err: msg }});
      results.push({ id: raw.id, status: 'error', error: msg });
    }
  }

  await logInfo({ scope: 'processor', message: `processed batch of ${pending.length}`, data: { results } });

  return NextResponse.json({ ok: true, processed: pending.length, results });
}

export const POST = GET;
