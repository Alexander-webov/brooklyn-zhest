// Nominatim is free but rate-limited to 1 req/sec. We add caching and polite headers.
// https://operations.osmfoundation.org/policies/nominatim/

const cache = new Map();
let lastRequest = 0;

async function rateLimit() {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequest));
  if (wait) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
}

/**
 * Geocode an address string (assumed in NYC). Returns { lat, lng, display_name } or null.
 */
export async function geocode(address) {
  if (!address || typeof address !== 'string') return null;
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  await rateLimit();

  // bias towards NYC by adding "New York" if not present
  let q = address;
  if (!/new york|nyc|brooklyn|manhattan|queens|bronx|staten/i.test(q)) {
    q = `${q}, Brooklyn, New York, NY`;
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');
  // bbox roughly around NYC
  url.searchParams.set('viewbox', '-74.2589,40.9176,-73.7004,40.4774');
  url.searchParams.set('bounded', '1');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': process.env.NOMINATIM_USER_AGENT || 'BrooklynWatch/1.0',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const arr = await res.json();
    const hit = arr?.[0];
    if (!hit) {
      cache.set(key, null);
      return null;
    }
    const out = {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      display_name: hit.display_name
    };
    cache.set(key, out);
    return out;
  } catch (e) {
    console.warn('[geocode] failed', e?.message);
    return null;
  }
}

/**
 * Match an address+coordinates to a neighborhood from a pre-loaded list.
 * Returns the best-matching neighborhood object or null.
 */
export function matchNeighborhood({ address, lat, lng }, neighborhoods) {
  if (!neighborhoods?.length) return null;

  const text = (address || '').toLowerCase();

  // 1. keyword match (most reliable)
  if (text) {
    for (const n of neighborhoods) {
      for (const kw of n.keywords || []) {
        if (kw && text.includes(kw.toLowerCase())) return n;
      }
    }
  }

  // 2. fall back to nearest center within radius
  if (lat && lng) {
    let best = null;
    let bestDist = Infinity;
    for (const n of neighborhoods) {
      if (n.center_lat == null || n.center_lng == null) continue;
      const d = haversine(lat, lng, n.center_lat, n.center_lng);
      const r = n.radius_meters || 1500;
      if (d <= r && d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    if (best) return best;
  }

  // 3. last-resort fallback: the "Бруклин (общий)" entry, if present
  return neighborhoods.find(n => n.hashtag === '#бруклин') || null;
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
