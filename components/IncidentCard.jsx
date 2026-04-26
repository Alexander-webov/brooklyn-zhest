'use client';
import { useState } from 'react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { ru } from 'date-fns/locale';

const TYPE_EMOJI = {
  shooting: '🚨', robbery: '🚨', fire: '🔥', arrest: '🚓', missing: '🆘',
  assault: '⚠️', theft: '🕵️', crash: '🚗', weapon: '🔫', drugs: '💊',
  suspicious: '👁️', emergency: '🚑', other: '📍'
};

const STATUS_TONE = {
  pending:   { bg: 'bg-ink-50',     accent: 'text-signal-amber',  label: 'PENDING'   },
  approved:  { bg: 'bg-ink-50',     accent: 'text-signal-green',  label: 'APPROVED'  },
  published: { bg: 'bg-ink-100/50', accent: 'text-ink-700',        label: 'PUBLISHED' },
  rejected:  { bg: 'bg-ink-100/30', accent: 'text-ink-500',        label: 'REJECTED'  },
  merged:    { bg: 'bg-ink-100/30', accent: 'text-ink-500',        label: 'MERGED'    }
};

export function IncidentCard({ incident, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title_ru: incident.title_ru,
    body_ru: incident.body_ru,
    address: incident.address || '',
    landmark: incident.landmark || '',
    type: incident.type,
    score: incident.score
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const tone = STATUS_TONE[incident.status] || STATUS_TONE.pending;
  const ch = incident.channels || {};
  const nh = incident.neighborhoods || {};

  const occurred = incident.occurred_at || incident.created_at;
  const ago = occurred ? formatDistanceToNowStrict(new Date(occurred), { locale: ru, addSuffix: false }) + ' назад' : '—';

  const renderedPost = renderPreview({
    template: ch.post_template,
    type: draft.type,
    hashtag: nh.hashtag,
    timeAgo: ago,
    landmark: draft.landmark || draft.address || nh.name || 'Бруклин',
    body: draft.body_ru,
    sourceName: 'Источник'
  });

  // Action helper: shows feedback then waits a tick for DB to settle before refetching the list.
  const action = async (label, fn) => {
    setBusy(true); setFeedback('');
    try {
      await fn();
      setFeedback(label);
      // give Postgres + the network a moment so the next list fetch sees the new status
      setTimeout(() => {
        onChange?.();
      }, 500);
    } catch (e) {
      setFeedback('ошибка: ' + (e?.message || 'unknown'));
      setBusy(false);
    }
  };

  const approve = () => action('одобрено', async () => {
    const r = await fetch(`/api/incidents/${incident.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' })
    });
    if (!r.ok) throw new Error((await r.json()).error || 'failed');
  });

  const reject = () => action('отклонено', async () => {
    const r = await fetch(`/api/incidents/${incident.id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('failed');
  });

  const regen = () => action('перегенерировано', async () => {
    const r = await fetch(`/api/incidents/${incident.id}?action=regenerate`, { method: 'POST' });
    if (!r.ok) throw new Error((await r.json()).error || 'failed');
  });

  const publishNow = (test) => action(test ? 'отправлено в тест' : 'опубликовано', async () => {
    const r = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident_id: incident.id, force_test: !!test })
    });
    if (!r.ok) throw new Error((await r.json()).error || 'failed');
  });

  const saveEdit = () => action('сохранено', async () => {
    const r = await fetch(`/api/incidents/${incident.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    if (!r.ok) throw new Error((await r.json()).error || 'failed');
    setEditing(false);
  });

  return (
    <div className={`hairline ${tone.bg}`}>
      {/* Header strip */}
      <div className="flex items-center gap-3 px-4 py-2.5 hairline-b font-mono text-[0.7rem] uppercase tracking-[0.12em]">
        <span className={`${tone.accent} font-semibold`}>● {tone.label}</span>
        <span className="text-ink-500">{TYPE_EMOJI[incident.type] || '📍'} {incident.type}</span>
        <span className="text-ink-500">SCORE <span className="text-ink-900 tabular">{incident.score}</span></span>
        {nh.hashtag && <span className="text-ink-500">{nh.hashtag}</span>}
        <span className="flex-1" />
        <span className="text-ink-500">{ago}</span>
        {incident.edited_by_user && <span className="text-signal-amber">edit</span>}
      </div>

      <div className="grid lg:grid-cols-2 gap-px bg-transparent">
        {/* Left: content */}
        <div className="p-5">
          {!editing ? (
            <>
              <h3 className="font-serif text-xl italic leading-tight text-ink-900">{incident.title_ru}</h3>
              <p className="mt-3 text-sm text-ink-800 leading-relaxed whitespace-pre-line">{incident.body_ru}</p>
              <div className="mt-4 space-y-1 font-mono text-xs text-ink-600">
                {incident.address && <div>📍 {incident.address}</div>}
                {incident.landmark && <div>↳ {incident.landmark}</div>}
                {nh.name && <div>район: {nh.name} {nh.hashtag}</div>}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Field label="Заголовок"
                value={draft.title_ru}
                onChange={v => setDraft({ ...draft, title_ru: v })}/>
              <Field label="Тело" multi
                value={draft.body_ru}
                onChange={v => setDraft({ ...draft, body_ru: v })}/>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Адрес"
                  value={draft.address}
                  onChange={v => setDraft({ ...draft, address: v })}/>
                <Field label="Ориентир"
                  value={draft.landmark}
                  onChange={v => setDraft({ ...draft, landmark: v })}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Тип" value={draft.type}
                  onChange={v => setDraft({ ...draft, type: v })}
                  options={Object.keys(TYPE_EMOJI).map(k => ({ value: k, label: `${TYPE_EMOJI[k]} ${k}` }))}/>
                <Field label="Score" type="number" min={0} max={100}
                  value={draft.score}
                  onChange={v => setDraft({ ...draft, score: parseInt(v, 10) || 0 })}/>
              </div>
            </div>
          )}
        </div>

        {/* Right: post preview */}
        <div className="p-5 bg-ink-0/40 hairline-l border-l border-white/5">
          <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-600 mb-3">
            Превью поста · {ch.test_mode ? 'TEST' : 'LIVE'}
          </div>
          <div className="bg-[#181818] hairline rounded-none p-4 text-sm leading-relaxed whitespace-pre-line text-ink-900 font-sans">
            {renderedPost}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 hairline-t bg-ink-0/40">
        {!editing && (
          <>
            {incident.status === 'pending' && (
              <button className="btn btn-success" onClick={approve} disabled={busy}>✓ Одобрить</button>
            )}
            {(incident.status === 'pending' || incident.status === 'approved') && (
              <>
                <button className="btn btn-primary" onClick={() => publishNow(false)} disabled={busy}>
                  ⤴ Опубликовать сейчас
                </button>
                <button className="btn" onClick={() => publishNow(true)} disabled={busy}>
                  → в тест
                </button>
              </>
            )}
            <button className="btn" onClick={() => setEditing(true)} disabled={busy}>✎ Редактировать</button>
            <button className="btn" onClick={regen} disabled={busy}>↺ Перегенерировать</button>
            {incident.status !== 'rejected' && (
              <button className="btn btn-danger ml-auto" onClick={reject} disabled={busy}>✕ Отклонить</button>
            )}
          </>
        )}
        {editing && (
          <>
            <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>Сохранить</button>
            <button className="btn" onClick={() => setEditing(false)} disabled={busy}>Отмена</button>
          </>
        )}
        {feedback && (
          <span className="font-mono text-xs text-signal-green ml-2">{feedback}</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multi, type = 'text', min, max }) {
  return (
    <label className="block">
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">{label}</div>
      {multi ? (
        <textarea rows={4} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full" />
      ) : (
        <input type={type} min={min} max={max} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full" />
      )}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function renderPreview({ template, type, hashtag, timeAgo, landmark, body, sourceName }) {
  const t = template ||
    '{type_emoji} {neighborhood_hashtag}\n\n📍 {time_ago} · {landmark}\n\n{description}\n\n⚡ Источник: {source}';
  return t.replace(/\{(\w+)\}/g, (_, k) => {
    const map = {
      type_emoji: TYPE_EMOJI[type] || '📍',
      neighborhood_hashtag: hashtag || '#бруклин',
      time_ago: timeAgo,
      landmark,
      description: body,
      source: sourceName
    };
    return map[k] ?? '';
  });
}
