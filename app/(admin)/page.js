'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const r = await fetch('/api/stats');
    if (r.ok) setStats(await r.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <PageHeader
        kicker="Live · Brooklyn"
        title="Сводка"
        subtitle="Что происходит в системе прямо сейчас. Обновляется каждые 15 секунд."
      />

      <div className="px-8 py-8">
        {loading && !stats ? (
          <div className="font-mono text-sm text-ink-600">загрузка…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-ink-300/60">
              <Stat label="В очереди"      value={stats?.pending}    href="/queue?status=pending" tone="amber" />
              <Stat label="Одобрено"        value={stats?.approved}   href="/queue?status=approved" tone="green" />
              <Stat label="Опубл. за 24ч"   value={stats?.published24} tone="default" />
              <Stat label="Опубл. за 7д"    value={stats?.published7d} tone="default" />
              <Stat label="Спарсено за 24ч" value={stats?.raws24}     tone="default" mono />
              <Stat label="Ошибок за 24ч"   value={stats?.errors24}   href="/logs" tone={stats?.errors24 ? 'red' : 'default'} />
            </div>

            <div className="mt-12 grid lg:grid-cols-2 gap-12">
              <section>
                <SectionHeader label="Топ районов · 7 дней" />
                {stats?.topNeighborhoods?.length ? (
                  <div>
                    {stats.topNeighborhoods.map((n, i) => (
                      <div key={i} className="flex items-baseline gap-3 py-3 hairline-b last:border-b-0">
                        <span className="font-mono text-xs text-ink-500 w-6 tabular">{String(i + 1).padStart(2, '0')}</span>
                        <span className="font-serif text-lg italic text-ink-900 flex-1 truncate">{n.name}</span>
                        <span className="font-mono text-xs text-ink-600">{n.hashtag}</span>
                        <span className="font-mono text-base text-signal-red tabular">{n.n}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono text-xs text-ink-600 py-3">пока пусто</div>
                )}
              </section>

              <section>
                <SectionHeader label="Быстрые действия" />
                <div className="space-y-2">
                  <Link href="/queue?status=pending" className="block hairline px-4 py-3 hover:bg-ink-100 transition-colors">
                    <div className="text-sm text-ink-900">Просмотреть очередь модерации</div>
                    <div className="font-mono text-[0.7rem] text-ink-600 mt-1">→ /queue</div>
                  </Link>
                  <Link href="/sources" className="block hairline px-4 py-3 hover:bg-ink-100 transition-colors">
                    <div className="text-sm text-ink-900">Управление источниками</div>
                    <div className="font-mono text-[0.7rem] text-ink-600 mt-1">→ /sources</div>
                  </Link>
                  <Link href="/channels" className="block hairline px-4 py-3 hover:bg-ink-100 transition-colors">
                    <div className="text-sm text-ink-900">Настройки канала</div>
                    <div className="font-mono text-[0.7rem] text-ink-600 mt-1">→ /channels</div>
                  </Link>
                  <Link href="/logs" className="block hairline px-4 py-3 hover:bg-ink-100 transition-colors">
                    <div className="text-sm text-ink-900">Логи парсера / процессора</div>
                    <div className="font-mono text-[0.7rem] text-ink-600 mt-1">→ /logs</div>
                  </Link>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, href, tone = 'default', mono = false }) {
  const tones = {
    default: 'text-ink-900',
    red:     'text-signal-red',
    amber:   'text-signal-amber',
    green:   'text-signal-green'
  };
  const Comp = href ? Link : 'div';
  return (
    <Comp href={href || ''} className="bg-ink-50 px-5 py-5 hover:bg-ink-100 transition-colors block">
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-2">{label}</div>
      <div className={`text-3xl tabular ${tones[tone]} ${mono ? 'font-mono' : 'font-serif italic'}`}>
        {value ?? '—'}
      </div>
    </Comp>
  );
}

function SectionHeader({ label }) {
  return (
    <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-600 mb-4 flex items-center gap-3">
      <span>{label}</span>
      <span className="flex-1 h-px bg-ink-300/60" />
    </div>
  );
}
