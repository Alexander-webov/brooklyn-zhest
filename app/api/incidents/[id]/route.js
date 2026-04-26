import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { processRawIncident } from '@/lib/groq';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const sb = admin();

  const allowed = ['title_ru', 'body_ru', 'address', 'landmark', 'type', 'score',
                   'neighborhood_id', 'status', 'occurred_at'];
  const patch = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }
  patch.edited_by_user = true;

  const { data, error } = await sb.from('incidents').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ incident: data });
}

export async function DELETE(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const sb = admin();
  const { error } = await sb.from('incidents').update({ status: 'rejected' }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req, { params }) {
  if (!(await getSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  const sb = admin();

  if (action === 'regenerate') {
    // re-run LLM on the first raw_incident
    const { data: inc } = await sb.from('incidents').select('raw_incident_ids').eq('id', id).single();
    const rawId = inc?.raw_incident_ids?.[0];
    if (!rawId) return NextResponse.json({ error: 'no raw to regenerate from' }, { status: 400 });

    const { data: raw } = await sb.from('raw_incidents')
      .select('*, sources(name)').eq('id', rawId).single();
    if (!raw) return NextResponse.json({ error: 'raw not found' }, { status: 404 });

    const llm = await processRawIncident({
      source_name: raw.sources?.name,
      url: raw.raw_url,
      published_at: raw.raw_published_at,
      title: raw.raw_title,
      body: raw.raw_body
    });

    const { data, error } = await sb.from('incidents').update({
      title_ru: llm.title_ru,
      body_ru: llm.body_ru,
      type: llm.type || 'other',
      score: llm.score ?? 50,
      address: llm.address,
      landmark: llm.landmark
    }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ incident: data });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
