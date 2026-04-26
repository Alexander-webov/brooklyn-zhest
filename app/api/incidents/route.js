import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');           // pending|approved|rejected|published|all
  const channelId = url.searchParams.get('channel_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const sb = admin();
  let q = sb.from('incidents')
    .select('*, neighborhoods(name, hashtag), channels(name, slug, post_template, test_mode, telegram_chat_id, telegram_test_chat_id)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') q = q.eq('status', status);
  if (channelId) q = q.eq('channel_id', channelId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ incidents: data });
}
