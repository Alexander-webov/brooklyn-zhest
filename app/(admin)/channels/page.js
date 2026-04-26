'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/channels');
    if (r.ok) {
      const j = await r.json();
      setChannels(j.channels || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        kicker="Multi-tenant"
        title="Каналы"
        subtitle="Каждый канал — отдельная лента в Telegram со своими настройками, источниками и районами. Один движок крутит все."
      />

      <div className="px-8 py-8 space-y-8">
        {loading ? (
          <div className="font-mono text-sm text-ink-600">загрузка…</div>
        ) : channels.map(ch => (
          <ChannelEditor key={ch.id} channel={ch} onChange={load} />
        ))}
      </div>
    </>
  );
}

function ChannelEditor({ channel, onChange }) {
  const [draft, setDraft] = useState({ ...channel });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [chatTest, setChatTest] = useState(null);

  const save = async () => {
    setBusy(true); setFeedback('');
    const r = await fetch(`/api/channels/${channel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    setBusy(false);
    if (r.ok) {
      setFeedback('сохранено');
      onChange?.();
      setTimeout(() => setFeedback(''), 2000);
    } else {
      const j = await r.json();
      setFeedback('ошибка: ' + (j.error || 'unknown'));
    }
  };

  const testChat = async () => {
    setBusy(true); setChatTest(null);
    const r = await fetch(`/api/channels/${channel.id}?action=test_chat`, { method: 'POST' });
    const j = await r.json();
    setBusy(false);
    setChatTest(j);
  };

  const set = (patch) => setDraft({ ...draft, ...patch });

  return (
    <div className="hairline bg-ink-50">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 hairline-b">
        <div className={`w-2 h-2 rounded-full ${channel.is_enabled ? 'bg-signal-green' : 'bg-ink-500'}`} />
        <div className="flex-1">
          <div className="font-serif italic text-2xl text-ink-900 leading-none">{channel.name}</div>
          <div className="font-mono text-[0.7rem] text-ink-600 mt-1">slug: {channel.slug}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`tag ${channel.test_mode ? 'text-signal-amber' : 'text-signal-green'}`}>
            {channel.test_mode ? 'TEST MODE' : 'LIVE'}
          </span>
          <span className="tag">{channel.mode}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-px bg-ink-300/40">
        {/* LEFT: identity + telegram */}
        <div className="bg-ink-50 p-6 space-y-4">
          <Section label="Идентификатор">
            <Field label="Название" value={draft.name} onChange={(v) => set({ name: v })} />
            <Field label="Описание" value={draft.description || ''} onChange={(v) => set({ description: v })} multi />
          </Section>

          <Section label="Telegram">
            <Field label="Boevoy chat_id" value={draft.telegram_chat_id} onChange={(v) => set({ telegram_chat_id: v })}
              hint="@username публичного канала или числовой id (-100...)" />
            <Field label="Тестовый chat_id" value={draft.telegram_test_chat_id || ''} onChange={(v) => set({ telegram_test_chat_id: v })}
              hint="Числовой id приватного канала. Получить: добавь @RawDataBot в канал и перешли любой пост." />
            <Toggle label="Тестовый режим" sub="Все посты идут в тестовый канал, не в боевой"
              value={draft.test_mode} onChange={(v) => set({ test_mode: v })} />
            <button className="btn" onClick={testChat} disabled={busy}>Проверить chat_id</button>
            {chatTest && (
              <div className={`font-mono text-xs p-2 ${chatTest.result?.ok ? 'text-signal-green' : 'text-signal-red'}`}>
                target: {chatTest.target}<br/>
                {chatTest.result?.ok
                  ? `OK → ${chatTest.result.result?.title || chatTest.result.result?.username}`
                  : `error: ${chatTest.result?.description || 'unknown'}`}
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT: behaviour */}
        <div className="bg-ink-50 p-6 space-y-4">
          <Section label="Режим работы">
            <Toggle label="Канал включён" sub="Полностью отключает парсинг и публикацию"
              value={draft.is_enabled} onChange={(v) => set({ is_enabled: v })} />
            <Select label="Режим публикации" value={draft.mode} onChange={(v) => set({ mode: v })}
              options={[
                { value: 'manual', label: 'Manual — только вручную из очереди' },
                { value: 'hybrid', label: 'Hybrid — авто при score ≥ 70, остальные в очередь' },
                { value: 'auto',   label: 'Auto — авто при score ≥ min_score' }
              ]}/>
          </Section>

          <Section label="Расписание">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Min score" type="number" min="0" max="100"
                value={draft.min_score} onChange={(v) => set({ min_score: parseInt(v, 10) || 0 })} />
              <Field label="Интервал, мин" type="number" min="1"
                value={draft.min_interval_minutes} onChange={(v) => set({ min_interval_minutes: parseInt(v, 10) || 1 })} />
              <Field label="Макс/сутки" type="number" min="1"
                value={draft.max_per_day} onChange={(v) => set({ max_per_day: parseInt(v, 10) || 1 })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quiet hours от" type="number" min="0" max="23"
                value={draft.quiet_hours_start ?? ''}
                onChange={(v) => set({ quiet_hours_start: v === '' ? null : parseInt(v, 10) })}
                hint="час 0-23 (NY time). пусто = без quiet hours"/>
              <Field label="до" type="number" min="0" max="23"
                value={draft.quiet_hours_end ?? ''}
                onChange={(v) => set({ quiet_hours_end: v === '' ? null : parseInt(v, 10) })}/>
            </div>
          </Section>

          <Section label="Дедупликация">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Радиус, метров" type="number" min="0"
                value={draft.dedup_radius_meters} onChange={(v) => set({ dedup_radius_meters: parseInt(v, 10) || 0 })} />
              <Field label="Окно, часов" type="number" min="1"
                value={draft.dedup_window_hours} onChange={(v) => set({ dedup_window_hours: parseInt(v, 10) || 1 })} />
            </div>
          </Section>
        </div>
      </div>

      {/* Template — full width */}
      <div className="hairline-t p-6 space-y-2 bg-ink-50">
        <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-600">Шаблон поста</div>
        <textarea
          rows={7}
          value={draft.post_template || ''}
          onChange={(e) => set({ post_template: e.target.value })}
          className="w-full font-mono text-sm leading-relaxed"
        />
        <div className="font-mono text-[0.65rem] text-ink-500">
          переменные: <span className="text-ink-700">{'{type_emoji}'}</span> · <span className="text-ink-700">{'{neighborhood_hashtag}'}</span> · <span className="text-ink-700">{'{time_ago}'}</span> · <span className="text-ink-700">{'{landmark}'}</span> · <span className="text-ink-700">{'{description}'}</span> · <span className="text-ink-700">{'{source}'}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-3 hairline-t bg-ink-100/40">
        {feedback && <span className="font-mono text-xs text-signal-green">{feedback}</span>}
        <button className="btn btn-primary" onClick={save} disabled={busy}>Сохранить</button>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-600 flex items-center gap-3">
        <span>{label}</span>
        <span className="flex-1 h-px bg-ink-300/60" />
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', min, max, multi, hint }) {
  return (
    <label className="block">
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">{label}</div>
      {multi ? (
        <textarea rows={2} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full"/>
      ) : (
        <input type={type} min={min} max={max} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-full"/>
      )}
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

function Toggle({ label, sub, value, onChange }) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors relative ${
          value ? 'bg-signal-red' : 'bg-ink-300'
        }`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-ink-900 transition-all ${
          value ? 'left-[22px]' : 'left-0.5'
        }`}/>
      </button>
      <div className="leading-tight">
        <div className="text-sm text-ink-900">{label}</div>
        {sub && <div className="font-mono text-[0.65rem] text-ink-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
