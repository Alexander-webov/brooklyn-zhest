import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const level = url.searchParams.get('level'); // info|warn|error|null
  const scope = url.searchParams.get('scope');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);

  let q = admin().from('logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (level && level !== 'all') q = q.eq('level', level);
  if (scope && scope !== 'all') q = q.eq('scope', scope);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data });
}
