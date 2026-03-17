"use client";

const expectedFulfillmentRankGuide = [
  { rank: "S", label: "現在の役割期待を大きく上回っている" },
  { rank: "A", label: "現在の役割期待を上回っている" },
  { rank: "B", label: "現在の役割期待を安定して満たしている" },
  { rank: "C", label: "現在の役割期待に一部不足がある" },
  { rank: "D", label: "現在の役割期待に明確な不足がある" },
] as const;

type ExpectedFulfillmentRankGuideProps = {
  className?: string;
};

export function ExpectedFulfillmentRankGuide({ className }: ExpectedFulfillmentRankGuideProps) {
  return (
    <section className={className ?? "rounded-3xl border border-amber-200 bg-amber-50/70 p-4"}>
      <h3 className="font-semibold text-slate-950">期待充足ランクの見方</h3>
      <p className="mt-1 text-sm text-slate-600">
        成長幅ではなく、現在の役割期待に対してどの程度充足できているかを見る補助指標です。
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {expectedFulfillmentRankGuide.map((item) => (
          <article key={item.rank} className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm text-slate-700">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">{item.rank}</p>
            <p className="mt-2 font-semibold text-slate-950">{item.label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
