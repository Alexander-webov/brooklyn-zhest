'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

export default function NeighborhoodsPage() {
  const [items, setItems] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [n, c] = await Promise.all([
      fetch('/api/neighborhoods').then(r => r.json()),
      fetch('/api/channels').then(r => r.json())
    ]);
    setItems(n.neighborhoods || []);
    setChannels(c.channels || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (id, patch) => {
    setBusyId(id);
    await fetch(`/api/neighborhoods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    setBusyId(null);
    load();
  };

  const remove = async (n) => {
    if (!confirm(`Удалить район "${n.name}"?`)) return;
    setBusyId(n.id);
    await fetch(`/api/neighborhoods/${n.id}`, { method: 'DELETE' });
    setBusyId(null);
    load();
  };

  return (
    <>
      <PageHeader
        kicker="Geo · routing"
        title="Районы и хэштеги"
        subtitle="Каждый инцидент попадает в район по ключевым словам в адресе или геокоординатам. Хэштег идёт в пост."
      >
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Добавить</button>
      </PageHeader>

      <div className="px-8 py-8">
        {loading ? (
          <div className="font-mono text-sm text-ink-600">загрузка…</div>
        ) : (
          <div className="hairline">
            <div className="grid grid-cols-12 gap-3 px-4 py-2 hairline-b font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 bg-ink-100/40">
              <div className="col-span-3">Название</div>
              <div className="col-span-2">Хэштег</div>
              <div className="col-span-4">Ключевые слова</div>
              <div className="col-span-2">Координаты</div>
              <div className="col-span-1 text-right">—</div>
            </div>
            {items.map(n => (
              <NeighborhoodRow
                key={n.id}
                n={n}
                busy={busyId === n.id}
                onUpdate={(patch) => update(n.id, patch)}
                onDelete={() => remove(n)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddModal channels={channels} onClose={() => setShowAdd(false)} onAdded={load}/>
      )}
    </>
  );
}

function NeighborhoodRow({ n, busy, onUpdate, onDelete }) {
  const [keywords, setKeywords] = useState((n.keywords || []).join(', '));
  const [name, setName] = useState(n.name);
  const [hashtag, setHashtag] = useState(n.hashtag);

  const save = () => {
    onUpdate({
      name,
      hashtag,
      keywords: keywords.split(',').map(s => s.trim()).filter(Boolean)
    });
  };

  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3 hairline-b last:border-b-0 items-center">
      <div className="col-span-3">
        <input value={name} onChange={(e) => setName(e.target.value)}
          onBlur={save} className="w-full" disabled={busy}/>
      </div>
      <div className="col-span-2">
        <input value={hashtag} onChange={(e) => setHashtag(e.target.value)}
          onBlur={save} className="w-full font-mono text-xs" disabled={busy}/>
      </div>
      <div className="col-span-4">
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
          onBlur={save}
          placeholder="через запятую"
          className="w-full font-mono text-xs" disabled={busy}/>
      </div>
      <div className="col-span-2 font-mono text-[0.7rem] text-ink-600 tabular">
        {n.center_lat ? `${n.center_lat.toFixed(3)}, ${n.center_lng.toFixed(3)}` : '—'}
      </div>
      <div className="col-span-1 text-right">
        <button className="btn btn-danger" onClick={onDelete} disabled={busy}>✕</button>
      </div>
    </div>
  );
}

function AddModal({ channels, onClose, onAdded }) {
  const [form, setForm] = useState({
    channel_id: channels[0]?.id || '',
    name: '',
    hashtag: '',
    keywords: '',
    center_lat: '',
    center_lng: '',
    radius_meters: 1500
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = {
        channel_id: form.channel_id,
        name: form.name,
        hashtag: form.hashtag.startsWith('#') ? form.hashtag : '#' + form.hashtag,
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
        center_lat: form.center_lat ? parseFloat(form.center_lat) : null,
        center_lng: form.center_lng ? parseFloat(form.center_lng) : null,
        radius_meters: parseInt(form.radius_meters, 10) || 1500
      };
      const r = await fetch('/api/neighborhoods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error((await r.json()).error || 'failed');
      onAdded(); onClose();
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
          <div className="font-serif italic text-xl text-ink-900">Новый район</div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-3">
          <label className="block">
            <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">Канал</div>
            <select value={form.channel_id} onChange={(e) => setForm({ ...form, channel_id: e.target.value })} className="w-full">
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">Название</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" required/>
          </label>
          <label className="block">
            <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">Хэштег</div>
            <input value={form.hashtag} onChange={(e) => setForm({ ...form, hashtag: e.target.value })} className="w-full" required placeholder="#бруклин"/>
          </label>
          <label className="block">
            <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">Ключевые слова (через запятую)</div>
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} className="w-full" placeholder="Brighton Beach, Brighton Beach Ave"/>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">Lat</div>
              <input value={form.center_lat} onChange={(e) => setForm({ ...form, center_lat: e.target.value })} className="w-full"/>
            </label>
            <label className="block">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">Lng</div>
              <input value={form.center_lng} onChange={(e) => setForm({ ...form, center_lng: e.target.value })} className="w-full"/>
            </label>
            <label className="block">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-600 mb-1">Радиус (м)</div>
              <input type="number" value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: e.target.value })} className="w-full"/>
            </label>
          </div>
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
