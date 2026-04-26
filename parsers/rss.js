import Parser from 'rss-parser';
import { admin } from '../lib/supabase-admin.js';
import { logError, logInfo } from '../lib/logger.js';

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'BrooklynWatch/1.0' }
});

/**
 * Fetches an RSS feed and stores new items into raw_incidents.
 *
 * Supported source.config:
 *   borough_filter: string         — text must include this (case-insensitive). e.g. "Brooklyn"
 *   keyword_filter: string[]       — text must include AT LEAST ONE of these words
 *   exclude_keywords: string[]     — text must NOT include any of these (politics, culture, etc.)
 *   require_all: boolean           — if true, both filters must match (default: true)
 */
export async function parseRss(source) {
  const sb = admin();
  let fetched = 0, inserted = 0, filtered = 0;

  try {
    const feed = await parser.parseURL(source.url);
    fetched = feed.items?.length || 0;

    const cfg = source.config || {};
    const boroughFilter   = cfg.borough_filter ? cfg.borough_filter.toLowerCase() : null;
    const keywordFilter   = (cfg.keyword_filter || []).map(s => s.toLowerCase()).filter(Boolean);
    const excludeKeywords = (cfg.exclude_keywords || []).map(s => s.toLowerCase()).filter(Boolean);

    const rows = [];
    for (const item of feed.items || []) {
      const text = `${item.title || ''} ${item.contentSnippet || item.content || ''}`.toLowerCase();

      // --- filtering at parser level (saves LLM tokens) ---
      if (boroughFilter && !text.includes(boroughFilter)) { filtered++; continue; }
      if (keywordFilter.length && !keywordFilter.some(k => text.includes(k))) { filtered++; continue; }
      if (excludeKeywords.length && excludeKeywords.some(k => text.includes(k))) { filtered++; continue; }

      const externalId = item.guid || item.id || item.link || item.title;
      if (!externalId) continue;

      rows.push({
        source_id: source.id,
        channel_id: source.channel_id,
        external_id: String(externalId).slice(0, 500),
        raw_title: (item.title || '').slice(0, 500),
        raw_body:  (item.contentSnippet || item.content || '').slice(0, 4000),
        raw_url:   item.link || null,
        raw_published_at: item.isoDate || item.pubDate || null,
        raw_data: { categories: item.categories, creator: item.creator }
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
      message: `RSS ${source.name}: feed=${fetched}, filtered=${filtered}, new=${inserted}` });

    return { fetched, inserted, filtered };
  } catch (e) {
    await sb.from('sources').update({
      last_run_at: new Date().toISOString(),
      last_error: String(e?.message || e).slice(0, 500)
    }).eq('id', source.id);
    await logError({ scope: 'parser', channel_id: source.channel_id, source_id: source.id,
      message: `RSS ${source.name} failed`, data: { error: String(e?.message || e) } });
    throw e;
  }
}
