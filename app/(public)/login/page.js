'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Ошибка');
      } else {
        router.push('/');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-signal-red text-3xl leading-none mb-4">●</div>
          <h1 className="font-serif text-[2.4rem] leading-none tracking-tight text-ink-900 italic">
            Brooklyn жесть
          </h1>
          <div className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-ink-600 mt-3">
            control room · access required
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full"
            disabled={loading}
          />
          {error && (
            <div className="font-mono text-xs text-signal-red px-1">{error}</div>
          )}
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading || !password}>
            {loading ? 'Проверяем...' : 'Войти'}
          </button>
        </form>

        <div className="mt-12 text-center font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-500">
          v0.1 · admin only
        </div>
      </div>
    </div>
  );
}
