import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { verifyCron } from '@/lib/cron-auth';
import { runParser } from '@/parsers';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = admin();

  // pick sources that are enabled and due for a refresh
  const { data: sources, error } = await sb
    .from('sources')
    .select('*, channels!inner(is_enabled)')
    .eq('is_enabled', true)
    .eq('channels.is_enabled', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const due = (sources || []).filter(s => {
    if (!s.last_run_at) return true;
    const elapsed = now - new Date(s.last_run_at).getTime();
    return elapsed >= s.frequency_minutes * 60 * 1000;
  });

  const results = [];
  // run sequentially to avoid hammering external APIs and Nominatim
  for (const src of due) {
    try {
      const r = await runParser(src);
      results.push({ source: src.name, ...r });
    } catch (e) {
      results.push({ source: src.name, error: String(e?.message || e) });
    }
  }

  return NextResponse.json({
    ok: true,
    triggered: due.length,
    skipped: (sources?.length || 0) - due.length,
    results
  });
}

export const POST = GET;
