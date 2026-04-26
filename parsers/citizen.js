import { admin } from '../lib/supabase-admin.js';
import { logError, logInfo } from '../lib/logger.js';

/**
 * Citizen.com has a public-facing JSON endpoint used by their map view.
 * URL: https://citizen.com/api/incident/trending?lowerLatitude=...&upperLatitude=...
 * 
 * NOTE: this is a public endpoint and works without auth, but it is technically
 * an internal API. Citizen may change or block it without notice. We treat it as
 * best-effort: if it 403/404s, we just log and move on.
 *
 * Source.config:
 *   { lowerLat, upperLat, lowerLong, upperLong, limit }
 *   Default = Brooklyn bounding box.
 */
const BROOKLYN_BBOX = {
  lowerLat:  40.5520,
  upperLat:  40.7395,
  lowerLong: -74.0560,
  upperLong: -73.8330
};

export async function parseCitizen(source) {
  const sb = admin();
  let fetched = 0, inserted = 0;

  try {
    const cfg = { ...BROOKLYN_BBOX, limit: 50, ...(source.config || {}) };
    const url = source.url
      || `https://citizen.com/api/incident/trending?lowerLatitude=${cfg.lowerLat}&upperLatitude=${cfg.upperLat}&lowerLongitude=${cfg.lowerLong}&upperLongitude=${cfg.upperLong}&fullResponse=true&limit=${cfg.limit}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) {
      throw new Error(`Citizen ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const results = json?.results || json?.hits || [];
    fetched = results.length;

    const rows = [];
    for (const inc of results) {
      // map the fields we need; structure may vary
      const id = inc.key || inc._id || inc.id;
      if (!id) continue;
      const title = inc.title || inc.raw || inc.summary || '';
      const desc = (inc.updates && Object.values(inc.updates).map(u => u.text).join('. ')) || inc.location || '';
      const lat = inc.latitude ?? inc.lat;
      const lng = inc.longitude ?? inc.lng;
      const ts  = inc.cs ? new Date(inc.cs).toISOString() : (inc.ts ? new Date(inc.ts).toISOString() : null);
      const address = inc.address || inc.location || '';

      rows.push({
        source_id: source.id,
        channel_id: source.channel_id,
        external_id: String(id),
        raw_title: String(title).slice(0, 500),
        raw_body: `${desc}\nAddress: ${address}`.slice(0, 4000),
        raw_url: `https://citizen.com/incidents/${id}`,
        raw_published_at: ts,
        raw_data: { lat, lng, address, level: inc.level, categories: inc.categories }
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
      message: `Citizen: fetched ${fetched}, new ${inserted}` });

    return { fetched, inserted };
  } catch (e) {
    await sb.from('sources').update({
      last_run_at: new Date().toISOString(),
      last_error: String(e?.message || e).slice(0, 500)
    }).eq('id', source.id);
    await logError({ scope: 'parser', channel_id: source.channel_id, source_id: source.id,
      message: `Citizen failed`, data: { error: String(e?.message || e) } });
    throw e;
  }
}
