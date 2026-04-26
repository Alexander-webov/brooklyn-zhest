import { admin } from '../lib/supabase-admin.js';
import { logError, logInfo } from '../lib/logger.js';

/**
 * Reddit's public .json endpoint — no auth required, ~60 req/min limit.
 * URL format: https://www.reddit.com/r/Brooklyn/new/.json
 */
export async function parseReddit(source) {
  const sb = admin();
  let fetched = 0, inserted = 0;

  try {
    const res = await fetch(source.url, {
      headers: {
        // Reddit blocks requests without a real User-Agent
        'User-Agent': 'BrooklynWatch/1.0 (by /u/brooklyn_watch_bot)',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) throw new Error(`Reddit ${res.status}: ${res.statusText}`);
    const json = await res.json();
    const posts = json?.data?.children || [];
    fetched = posts.length;

    const cfg = source.config || {};
    const minScore = cfg.min_score ?? 0;
    const flairs = (cfg.flairs || []).map(s => s.toLowerCase());
    const keywords = (cfg.keyword_filter || []).map(s => s.toLowerCase());

    const rows = [];
    for (const p of posts) {
      const d = p.data;
      if (!d || d.stickied || d.over_18) continue;
      if (d.score < minScore) continue;

      const flair = (d.link_flair_text || '').toLowerCase();
      if (flairs.length && !flairs.includes(flair)) continue;

      const haystack = `${d.title || ''} ${d.selftext || ''}`.toLowerCase();
      if (keywords.length && !keywords.some(k => haystack.includes(k))) continue;

      rows.push({
        source_id: source.id,
        channel_id: source.channel_id,
        external_id: String(d.id),
        raw_title: (d.title || '').slice(0, 500),
        raw_body:  (d.selftext || '').slice(0, 4000),
        raw_url:   d.url_overridden_by_dest || `https://reddit.com${d.permalink}`,
        raw_published_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
        raw_data: { score: d.score, num_comments: d.num_comments, subreddit: d.subreddit, flair: d.link_flair_text }
      });
    }

    if (rows.length) {
      const { data, error } = await sb
        .from('raw_incidents')
        .upsert(rows, { onConflict: 'source_id,external_id', ignoreDuplicates: true })
        .select('id');
      if (error) throw error;
      inserted = data?.length || 0;
    }

    await sb.from('sources').update({
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      total_fetched: source.total_fetched + fetched
    }).eq('id', source.id);

    await logInfo({ scope: 'parser', channel_id: source.channel_id, source_id: source.id,
      message: `Reddit ${source.name}: fetched ${fetched}, new ${inserted}` });

    return { fetched, inserted };
  } catch (e) {
    await sb.from('sources').update({
      last_run_at: new Date().toISOString(),
      last_error: String(e?.message || e).slice(0, 500)
    }).eq('id', source.id);
    await logError({ scope: 'parser', channel_id: source.channel_id, source_id: source.id,
      message: `Reddit ${source.name} failed`, data: { error: String(e?.message || e) } });
    throw e;
  }
}
