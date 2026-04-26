'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

export default function SettingsPage() {
  const [filters, setFilters] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [newType, setNewType] = useState('stopword');
  const [newChannel, setNewChannel] = useState('');

  const load = async () => {
    setLoading(true);
    const [c] = await Promise.all([fetch('/api/channels').then(r => r.json())]);
    setChannels(c.channels || []);
    if (c.channels?.[0]) setNewChannel(c.channels[0].id);
    // filters are not exposed via API yet — fetch via supabase admin direct in a future iteration.
    // For now, this page is informational + cron secret display.
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        kicker="Configuration"
        title="Настройки"
        subtitle="Глобальные параметры системы. Большинство per-channel настроек — на странице Каналов."
      />

      <div className="px-8 py-8 space-y-10">
        <Section label="Cron-задачи" tone="info">
          <p className="text-sm text-ink-800 leading-relaxed mb-4">
            Эти эндпоинты надо дёргать снаружи через <a className="text-signal-red underline" href="https://cron-job.org" target="_blank">cron-job.org</a> или GitHub Actions, потому что Vercel Hobby даёт максимум 1 крон в день.
          </p>
          <CronUrl path="/api/cron/parse"   freq="каждые 10 минут" comment="Обходит источники и складывает сырые данные" />
          <CronUrl path="/api/cron/process" freq="каждые 5 минут"  comment="LLM-обработка, геокодинг, дедупликация" />
          <CronUrl path="/api/cron/publish" freq="каждые 2 минуты" comment="Постит одобренные инциденты в Telegram" />
          <p className="text-sm text-ink-700 mt-4 leading-relaxed">
            В заголовок каждого запроса добавь:
          </p>
          <code className="block mt-2 font-mono text-xs bg-ink-100 px-3 py-2 text-ink-800">
            Authorization: Bearer &lt;CRON_SECRET из .env&gt;
          </code>
          <p className="text-sm text-ink-700 mt-3 leading-relaxed">
            Или в URL добавь <code className="font-mono text-ink-900">?secret=&lt;CRON_SECRET&gt;</code> — cron-job.org так удобнее.
          </p>
        </Section>

        <Section label="Структура очереди">
          <ul className="text-sm text-ink-800 space-y-3 leading-relaxed">
            <li>
              <span className="text-signal-red font-mono text-xs mr-2">1</span>
              <strong>Парсер</strong> ходит по источникам и складывает <code className="font-mono text-xs text-ink-900">raw_incidents</code> со статусом <code className="font-mono text-xs">pending</code>.
            </li>
            <li>
              <span className="text-signal-red font-mono text-xs mr-2">2</span>
              <strong>Процессор</strong> прогоняет каждый сырой через Groq, переводит, классифицирует, геокодирует, дедуплицирует и создаёт запись в <code className="font-mono text-xs text-ink-900">incidents</code>.
            </li>
            <li>
              <span className="text-signal-red font-mono text-xs mr-2">3</span>
              <strong>Модератор</strong> (ты) одобряет или отклоняет в очереди. В hybrid/auto-режиме процессор сам ставит approved при высоком score.
            </li>
            <li>
              <span className="text-signal-red font-mono text-xs mr-2">4</span>
              <strong>Публикатор</strong> берёт следующий approved, форматирует по шаблону канала, отправляет в Telegram, ставит published.
            </li>
          </ul>
        </Section>

        <Section label="Выход">
          <button className="btn btn-danger" onClick={async () => {
            await fetch('/api/auth?action=logout', { method: 'POST' });
            window.location.href = '/login';
          }}>Завершить сессию</button>
        </Section>
      </div>
    </>
  );
}

function Section({ label, children }) {
  return (
    <section>
      <div className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink-600 mb-4 flex items-center gap-3">
        <span>{label}</span>
        <span className="flex-1 h-px bg-ink-300/60" />
      </div>
      {children}
    </section>
  );
}

function CronUrl({ path, freq, comment }) {
  return (
    <div className="hairline px-4 py-3 mb-2 bg-ink-50">
      <div className="flex items-center gap-3 flex-wrap">
        <code className="font-mono text-sm text-ink-900">{path}</code>
        <span className="tag text-ink-700">{freq}</span>
        <span className="font-mono text-[0.7rem] text-ink-600 flex-1">{comment}</span>
      </div>
    </div>
  );
}
