'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',              label: 'Обзор',         shortcut: '⌘1', icon: '◷' },
  { href: '/queue',         label: 'Очередь',       shortcut: '⌘2', icon: '◫' },
  { href: '/sources',       label: 'Источники',     shortcut: '⌘3', icon: '↯' },
  { href: '/neighborhoods', label: 'Районы',        shortcut: '⌘4', icon: '⌖' },
  { href: '/channels',      label: 'Каналы',        shortcut: '⌘5', icon: '◉' },
  { href: '/settings',      label: 'Настройки',     shortcut: '⌘6', icon: '⚙' },
  { href: '/logs',          label: 'Логи',          shortcut: '⌘7', icon: '≡' }
];

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth?action=logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <aside className="w-60 hairline-r flex flex-col shrink-0 sticky top-0 h-screen">
      {/* Brand */}
      <div className="px-5 py-6 hairline-b">
        <div className="flex items-center gap-2.5">
          <span className="text-signal-red text-xl leading-none">●</span>
          <div className="leading-tight">
            <div className="font-serif text-[1.2rem] tracking-tight text-ink-900 italic">Brooklyn жесть</div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-600">control room</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-ink-100 text-ink-900 hairline'
                  : 'text-ink-700 hover:text-ink-900 hover:bg-ink-100/50'
              }`}
            >
              <span className={`font-mono text-[0.95rem] ${active ? 'text-signal-red' : 'text-ink-500'}`}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 hairline-t">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink-700 hover:text-ink-900 hover:bg-ink-100/50 transition-colors"
        >
          <span className="font-mono text-[0.95rem] text-ink-500">⏻</span>
          <span>Выйти</span>
        </button>
        <div className="px-3 mt-3 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink-500">
          v0.1 · brooklyn-watch
        </div>
      </div>
    </aside>
  );
}
