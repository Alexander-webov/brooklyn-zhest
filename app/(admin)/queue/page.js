'use client';
import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { IncidentCard } from '@/components/IncidentCard';

const STATUS_TABS = [
  { key: 'pending',   label: 'В очереди' },
  { key: 'approved',  label: 'Одобренные' },
  { key: 'published', label: 'Опубликовано' },
  { key: 'rejected',  label: 'Отклонённые' },
  { key: 'all',       label: 'Все' }
];

export default function QueuePage() {
  const [status, setStatus] = useState('pending');
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const url = new URL(window.location.href);
    const s = url.searchParams.get('status');
    if (s) setStatus(s);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/incidents?status=${status}&limit=80`)
      .then(r => r.json())
      .then(json => {
        setIncidents(json.incidents || []);
        setLoading(false);
      });
  }, [status, reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  return (
    <>
      <PageHeader
        kicker="Modulation"
        title="Очередь"
        subtitle="Инциденты после LLM-обработки. Одобрите, отредактируйте или отклоните каждый перед публикацией."
      >
        <button onClick={reload} className="btn">↻ Обновить</button>
      </PageHeader>

      {/* Tabs */}
      <div className="px-8 hairline-b">
        <div className="flex gap-1 -mb-px">
          {STATUS_TABS.map(tab => {
            const active = tab.key === status;
            return (
              <button
                key={tab.key}
                onClick={() => setStatus(tab.key)}
                className={`px-4 py-3 text-sm transition-colors ${
                  active
                    ? 'text-ink-900 border-b-2 border-signal-red'
                    : 'text-ink-600 hover:text-ink-800 border-b-2 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-8 py-8">
        {loading ? (
          <div className="font-mono text-sm text-ink-600">загрузка…</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-20">
            <div className="font-serif italic text-2xl text-ink-700 mb-2">Тишина</div>
            <div className="font-mono text-xs text-ink-500">Нет инцидентов в этом статусе</div>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map(inc => (
              <IncidentCard key={inc.id} incident={inc} onChange={reload} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
