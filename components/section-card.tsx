type SectionCardProps = Readonly<{
  title: string;
  description: string;
  badge?: string;
}>;

export function SectionCard({ title, description, badge }: SectionCardProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur">
      {badge ? (
        <p className="mb-4 inline-flex rounded-full border border-brand-300/30 bg-brand-400/10 px-3 py-1 text-xs font-medium text-brand-200">
          {badge}
        </p>
      ) : null}
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
    </section>
  );
}
