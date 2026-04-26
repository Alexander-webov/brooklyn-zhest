export function PageHeader({ title, subtitle, kicker, children }) {
  return (
    <div className="px-8 pt-10 pb-6 hairline-b">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          {kicker && (
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-signal-red mb-2">
              {kicker}
            </div>
          )}
          <h1 className="font-serif text-[2.2rem] leading-none tracking-tight text-ink-900 italic">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-sm text-ink-700 max-w-2xl leading-relaxed">{subtitle}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
