/** Layout for static information pages (help, safety, legal). */
export function ProsePage({ eyebrow, title, intro, updated, children }: { eyebrow?: string; title: string; intro?: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface">
      <header className="border-b border-line bg-gradient-to-b from-navy-50 to-white">
        <div className="container-page max-w-3xl py-12 sm:py-16">
          {eyebrow && <p className="mb-2 text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">{eyebrow}</p>}
          <h1 className="font-display text-4xl font-semibold text-navy-900 sm:text-5xl">{title}</h1>
          {intro && <p className="mt-4 text-lg text-muted">{intro}</p>}
          {updated && <p className="mt-3 text-xs text-muted">Last updated {updated}</p>}
        </div>
      </header>
      <div className="container-page prose-page max-w-3xl py-10 sm:py-14">{children}</div>
    </div>
  );
}
