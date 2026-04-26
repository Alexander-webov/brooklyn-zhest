import { admin } from '../lib/supabase-admin.js';
import { logError, logInfo } from '../lib/logger.js';

/**
 * Scrapes NYPD News press release listing page (their RSS is broken).
 * URL: https://www.nyc.gov/site/nypd/news/news.page (official) or nypdnews.com homepage.
 * We try a few endpoints because they shift around.
 */
const ENDPOINTS = [
  'https://www.nyc.gov/site/nypd/news/news.page',
  'https://nypdnews.com/'
];

export async function parseNypdHtml(source) {
  const sb = admin();
  let fetched = 0, inserted = 0;
  let lastErr;

  for (const url of [source.url, ...ENDPOINTS]) {
    if (!url) continue;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 BrooklynWatch/1.0' },
        redirect: 'follow'
      });
      if (!res.ok) { lastErr = `${url} → ${res.status}`; continue; }
      const html = await res.text();

      // Extract all <article> blocks or links to press releases.
      // We use a tolerant regex (don't want a full HTML parser dep).
      const items = extractArticles(html, url);
      fetched = items.length;
      if (!fetched) { lastErr = `${url} → 0 items extracted`; continue; }

      const cfg = source.config || {};
      const boroughFilter = cfg.borough_filter; // e.g. "Brooklyn"

      const rows = [];
      for (const it of items) {
        const text = `${it.title} ${it.body}`.toLowerCase();
        if (boroughFilter && !text.includes(boroughFilter.toLowerCase())) continue;
        rows.push({
          source_id: source.id,
          channel_id: source.channel_id,
          external_id: it.url || it.title,
          raw_title: it.title.slice(0, 500),
          raw_body: (it.body || '').slice(0, 4000),
          raw_url: it.url,
          raw_published_at: it.date || null,
          raw_data: { scraped_from: url }
        });
      }

      if (rows.length) {
        const { data, error } = await sb.from('raw_incidents')
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
        message: `NYPD-HTML ${url}: items ${fetched}, new ${inserted}` });

      return { fetched, inserted };
    } catch (e) {
      lastErr = String(e?.message || e);
    }
  }

  await sb.from('sources').update({
    last_run_at: new Date().toISOString(),
    last_error: (lastErr || 'unknown').slice(0, 500)
  }).eq('id', source.id);
  await logError({ scope: 'parser', channel_id: source.channel_id, source_id: source.id,
    message: `NYPD-HTML failed`, data: { lastErr } });
  throw new Error(lastErr || 'all endpoints failed');
}

function extractArticles(html, baseUrl) {
  const out = [];
  const seen = new Set();

  // Strategy 1: <article>...</article> blocks
  const articleRe = /<article[\s\S]*?<\/article>/gi;
  for (const block of html.match(articleRe) || []) {
    const a = parseBlock(block, baseUrl);
    if (a && !seen.has(a.url || a.title)) { seen.add(a.url || a.title); out.push(a); }
  }

  // Strategy 2: WordPress-style <h2><a href="...">title</a></h2> followed by excerpt
  const hRe = /<h[12345][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{15,200})<\/a>/gi;
  let m;
  while ((m = hRe.exec(html))) {
    const url = absolutize(m[1], baseUrl);
    const title = decode(m[2]).trim();
    if (seen.has(url) || seen.has(title)) continue;
    seen.add(url);
    out.push({ url, title, body: '', date: null });
  }

  return out.slice(0, 30); // cap
}

function parseBlock(block, baseUrl) {
  const linkM = block.match(/<a[^>]+href=["']([^"']+)["']/i);
  const titleM = block.match(/<(?:h\d|a)[^>]*>([^<]{15,200})<\/(?:h\d|a)>/i);
  const dateM  = block.match(/datetime=["']([^"']+)["']/i)
              || block.match(/(\d{4}-\d{2}-\d{2})/);
  const pM     = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const title = titleM ? decode(titleM[1]).trim() : null;
  if (!title) return null;
  return {
    title,
    url: linkM ? absolutize(linkM[1], baseUrl) : null,
    body: pM ? decode(stripTags(pM[1])).slice(0, 800) : '',
    date: dateM ? dateM[1] : null
  };
}

function absolutize(href, base) {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function stripTags(s) { return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}
