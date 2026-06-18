import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { verifyCron } from '@/lib/cron-auth';
import { logInfo, logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Чистка устаревших данных. Гонять раз в сутки.
// Пороги заданы дефолтами в SQL-функции cleanup_old_data().
export async function GET(req) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = admin();
  const { data, error } = await sb.rpc('cleanup_old_data');

  if (error) {
    await logError({ scope: 'cron', message: 'cleanup failed', data: { err: error.message } });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logInfo({ scope: 'cron', message: 'cleanup done', data });
  return NextResponse.json({ ok: true, ...data });
}

export const POST = GET;
