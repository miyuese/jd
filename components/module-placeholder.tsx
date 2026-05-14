type PlaceholderSection = {
  eyebrow: string;
  title: string;
  description: string;
};

type ModulePlaceholderProps = {
  badge: string;
  title: string;
  description: string;
  sections: PlaceholderSection[];
};

export function ModulePlaceholder({ badge, title, description, sections }: ModulePlaceholderProps) {
  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative max-w-3xl">
          <span className="soft-chip">{badge}</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className="page-card p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-sky-700">{section.eyebrow}</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{section.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{section.description}</p>
          </div>
        ))}
      </section>
    </>
  );
}
