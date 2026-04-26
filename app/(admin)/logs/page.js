'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { format } from 'date-fns';

const LEVEL_COLOR = {
  info:  'text-ink-700',
  debug: 'text-ink-600',
  warn:  'text-signal-amber',
  error: 'text-signal-red'
};

const SCOPES = ['all', 'parser', 'processor', 'publisher', 'api', 'cron'];

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState('all');
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);

  const load = async () => {
    const params = new URLSearchParams();
    if (level !== 'all') params.set('level', level);
    if (scope !== 'all') params.set('scope', scope);
    params.set('limit', '300');
    const r = await fetch('/api/logs?' + params);
    if (r.ok) {
      const j = await r.json();
      setLogs(j.logs || []);
    }
    setLoading(false);
  };

  useEffect(() => { setLoading(true); load(); }, [level, scope]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [auto, level, scope]);

  return (
    <>
      <PageHeader
        kicker="Diagnostics"
        title="Логи"
        subtitle="Последние записи парсеров, процессора, публикатора и API. Обновляется автоматически каждые 5 секунд."
      >
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)}/> авто
        </label>
        <button className="btn" onClick={load}>↻</button>
      </PageHeader>

      <div className="px-8 hairline-b">
        <div className="flex flex-wrap items-center gap-2 py-3">
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-600 mr-2">level</span>
          {['all', 'error', 'warn', 'info', 'debug'].map(l => (
            <button key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition-colors ${
                level === l ? 'bg-ink-100 text-ink-900 hairline' : 'text-ink-600 hover:text-ink-900'
              }`}>{l}</button>
          ))}
          <span className="w-px h-4 bg-ink-300/60 mx-2" />
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-600 mr-2">scope</span>
          {SCOPES.map(s => (
            <button key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition-colors ${
                scope === s ? 'bg-ink-100 text-ink-900 hairline' : 'text-ink-600 hover:text-ink-900'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="font-mono text-sm text-ink-600">загрузка…</div>
        ) : logs.length === 0 ? (
          <div className="font-mono text-sm text-ink-600">пусто</div>
        ) : (
          <div className="font-mono text-xs">
            {logs.map(l => (
              <div key={l.id} className="grid grid-cols-[110px_60px_90px_1fr] gap-3 py-1 hairline-b last:border-b-0">
                <span className="text-ink-500 tabular">{format(new Date(l.created_at), 'HH:mm:ss · dd.MM')}</span>
                <span className={LEVEL_COLOR[l.level] + ' uppercase'}>{l.level}</span>
                <span className="text-ink-600">{l.scope || '-'}</span>
                <span className="text-ink-800 break-words">
                  {l.message}
                  {l.data && (
                    <span className="text-ink-500"> · {JSON.stringify(l.data).slice(0, 200)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
