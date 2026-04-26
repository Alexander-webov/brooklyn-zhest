import { haversine } from './geocoder.js';

/**
 * Find an existing incident that is likely the same event.
 * Match criteria:
 *   - same channel
 *   - same `type`
 *   - within `window_hours` of occurred_at (or created_at)
 *   - addresses are within `radius_meters` (if both have coordinates)
 *     OR addresses share enough text overlap
 */
export function findDuplicate(candidate, recentIncidents, { radius_meters = 200, window_hours = 4 } = {}) {
  const candTime = new Date(candidate.occurred_at || candidate.created_at || Date.now()).getTime();
  const windowMs = window_hours * 60 * 60 * 1000;

  for (const ex of recentIncidents) {
    if (ex.id === candidate.id) continue;
    if (ex.channel_id !== candidate.channel_id) continue;
    if (ex.type !== candidate.type) continue;

    const exTime = new Date(ex.occurred_at || ex.created_at).getTime();
    if (Math.abs(candTime - exTime) > windowMs) continue;

    // geo match
    if (
      candidate.latitude != null && candidate.longitude != null &&
      ex.latitude != null && ex.longitude != null
    ) {
      const d = haversine(candidate.latitude, candidate.longitude, ex.latitude, ex.longitude);
      if (d <= radius_meters) return ex;
      continue; // both have coords but too far — definitely not dup
    }

    // text match fallback
    if (textOverlap(candidate.address, ex.address) > 0.6) return ex;
    if (textOverlap(candidate.body_ru, ex.body_ru) > 0.7) return ex;
  }
  return null;
}

function tokens(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 4)
  );
}

function textOverlap(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}
