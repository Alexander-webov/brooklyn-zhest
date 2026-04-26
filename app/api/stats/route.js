import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = admin();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [pending, approved, published24, published7d, raws24, errors24] = await Promise.all([
    sb.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    sb.from('publish_log').select('*', { count: 'exact', head: true }).gte('published_at', dayAgo),
    sb.from('publish_log').select('*', { count: 'exact', head: true }).gte('published_at', weekAgo),
    sb.from('raw_incidents').select('*', { count: 'exact', head: true }).gte('fetched_at', dayAgo),
    sb.from('logs').select('*', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', dayAgo),
  ]);

  // top neighborhoods this week
  const { data: top } = await sb
    .from('incidents')
    .select('neighborhood_id, neighborhoods(name, hashtag)')
    .eq('status', 'published')
    .gte('published_at', weekAgo);

  const counts = {};
  for (const r of top || []) {
    const key = r.neighborhood_id || 'none';
    counts[key] = counts[key] || { name: r.neighborhoods?.name || '—', hashtag: r.neighborhoods?.hashtag, n: 0 };
    counts[key].n++;
  }
  const topNeighborhoods = Object.values(counts).sort((a, b) => b.n - a.n).slice(0, 8);

  return NextResponse.json({
    pending: pending.count || 0,
    approved: approved.count || 0,
    published24: published24.count || 0,
    published7d: published7d.count || 0,
    raws24: raws24.count || 0,
    errors24: errors24.count || 0,
    topNeighborhoods
  });
}
