'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [s, c] = await Promise.all([
      fetch('/api/sources').then(r => r.json()),
      fetch('/api/channels').then(r => r.json())
    ]);
    setSources(s.sources || []);
    setChannels(c.channels || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (src) => {
    setBusyId(src.id);
    await fetch(`/api/sources/${src.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: !src.is_enabled })
    });
    setBusyId(null);
    load();
  };

  const updateField = async (src, field, value) => {
    setBusyId(src.id);
    await fetch(`/api/sources/${src.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });
    setBusyId(null);
    load();
  };

  const runNow = async (src) => {
    setBusyId(src.id);
    await fetch(`/api/sources/${src.id}?action=run`, { method: 'POST' });
    setBusyId(null);
    load();
  };

  const deleteSource = async (src) => {
    if (!confirm(`Удалить источник "${src.name}"?`)) return;
    setBusyId(src.id);
    await fetch(`/api/sources/${src.id}`, { method: 'DELETE' });
    setBusyId(null);
    load();
  };

  return (
    <>
      <PageHeader
        kicker="Pipeline · ingest"
        title="Источники"
        subtitle="RSS-ленты, сабреддиты, скрейперы. Парсер обходит включённые источники по расписанию и складывает сырые данные в очередь обработки."
      >
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Добавить</button>
      </PageHeader>

      <div className="px-8 py-8">
        {loading ? (
          <div className="font-mono text-sm text-ink-600">загрузка…</div>
        ) : (
          <div className="space-y-3">
            {sources.map(src => (
              <SourceRow
                key={src.id}
                src={src}
                channelName={channels.find(c => c.id === src.channel_id)?.name}
                busy={busyId === src.id}
                onToggle={() => toggleEnabled(src)}
                onUpdate={(field, value) => updateField(src, field, value)}
                onRun={() => runNow(src)}
                onDelete={() => deleteSource(src)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddSourceModal channels={channels} onClose={() => setShowAdd(false)} onAdded={load} />
      )}
    </>
  );
}

function SourceRow({ src, channelName, busy, onToggle, onUpdate, onRun, onDelete }) {
  const lastRun = src.last_run_at
    ? formatDistanceToNowStrict(new Date(src.last_run_at), { locale: ru }) + ' назад'
    : 'никогда';

  return (
    <div className={`hairline ${src.is_enabled ? 'bg-ink-50' : 'bg-ink-100/30 opacity-70'}`}>
      <div className="flex items-stretch gap-4 px-5 py-4">
        <button
          onClick={onToggle}
          disabled={busy}
          className={`shrink-0 self-start mt-1 w-10 h-5 rounded-full transition-colors relative ${
            src.is_enabled ? 'bg-signal-red' : 'bg-ink-300'
          }`}
          aria-label="toggle"
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-ink-900 transition-all ${
            src.is_enabled ? 'left-[22px]' : 'left-0.5'
          }`}/>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-serif text-lg italic text-ink-900 truncate">{src.name}</span>
            <span className="tag">{src.type}</span>
            {channelName && <span className="font-mono text-[0.7rem] text-ink-600">→ {channelName}</span>}
          </div>
          <div className="font-mono text-[0.7rem] text-ink-600 mt-1 truncate">{src.url}</div>

          <div className="flex items-center gap-5 mt-3 font-mono text-[0.7rem] text-ink-600 flex-wrap">
            <span>last run: <span className="text-ink-800">{lastRun}</span></span>
            <span>fetched: <span className="text-ink-800 tabular">{src.total_fetched}</span></span>
            {src.last_error && (
              <span className="text-signal-red truncate max-w-md" title={src.last_error}>
                ⚠ {src.last_error}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <label className="font-mono text-[0.65rem] uppercase tracking-wider text-ink-600 flex items-center gap-2">
            каждые
            <input
              type="number"
              min="5"
              max="1440"
              value={src.frequency_minutes}
              onChange={(e) => onUpdate('frequency_minutes', parseInt(e.target.value, 10) || 15)}
              className="w-16 text-center"
              disabled={busy}
            />
            мин
          </label>
          <div className="flex gap-2">
            <button className="btn" onClick={onRun} disabled={busy}>↻ Запустить</button>
            <button className="btn btn-danger" onClick={onDelete} disabled={busy}>✕</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSourceModal({ channels, onClose, onAdded }) {
  const [form, setForm] = useState({
    channel_id: channels[0]?.id || '',
    type: 'rss',
    name: '',
    url: '',
    frequency_minutes: 15,
    config: '{}'
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      let config = {};
      try { config = JSON.parse(form.config || '{}'); } catch { throw new Error('config: невалидный JSON'); }
      const r = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, config, frequency_minutes: parseInt(form.frequency_minutes, 10) })
      });
      if (!r.ok) throw new Error((await r.json()).error || 'failed');
      onAdded();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-0/85 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ink-50 hairline w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 hairline-b">
          <div className="font-serif italic text-xl text-ink-900">Новый источник</div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-3">
          <Select label="Канал" value={form.channel_id}
            onChange={(v) => setForm({ ...form, channel_id: v })}
            options={channels.map(c => ({ value: c.id, label: c.name }))}/>
          <Select label="Тип" value={form.type}
            onChange={(v) => setForm({ ...form, type: v })}
            options={[
              { value: 'rss', label: 'RSS' },
              { value: 'reddit', label: 'Reddit (.json)' }
            ]}/>
          <Input label="Название" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required/>
          <Input label="URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} required/>
          <Input label="Частота, мин" type="number" min="5" max="1440"
            value={form.frequency_minutes} onChange={(v) => setForm({ ...form, frequency_minutes: v })}/>
          <Input label="Config (JSON)" value={form.config}
            onChange={(v) => setForm({ ...form, config: v })}
            hint='{"borough_filter":"Brooklyn"} или {"keyword_filter":["brighton"]}'/>
          {error && <div className="font-mono text-xs text-signal-red">{error}</div>}
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" className="btn" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Создать</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', min, max, required, hint }) {
  return (
    <label className="block">
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">{label}</div>
      <input type={type} min={min} max={max} required={required} value={value || ''}
        onChange={(e) => onChange(e.target.value)} className="w-full"/>
      {hint && <div className="font-mono text-[0.65rem] text-ink-500 mt-1">{hint}</div>}
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
