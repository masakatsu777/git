import Link from "next/link";

import type { FinalReviewBundle } from "@/lib/evaluations/final-review-service";
import { getEvaluationGapGuidance } from "@/lib/evaluations/evaluation-gap-guidance";

type EvaluationGapDiagnosisCardProps = {
  summary: Pick<FinalReviewBundle, "gradeSalaryAmount" | "currentSalary" | "grossProfitVarianceRate" | "grossProfitDeductionAmount">;
};

export function EvaluationGapDiagnosisCard({ summary }: EvaluationGapDiagnosisCardProps) {
  const guidance = getEvaluationGapGuidance(summary);
  const isCurrentLevel = summary.gradeSalaryAmount === summary.currentSalary;
  const displayBadgeLabel = isCurrentLevel && guidance.quadrant.startsWith("low-eval")
    ? "現状維持圏"
    : guidance.badgeLabel;

  return (
    <section className={`rounded-[1.75rem] border p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ${guidance.panelTone}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.18em] ${guidance.badgeTone}`}>
              {displayBadgeLabel}
            </span>
            <span className="inline-flex rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-600">
              4象限診断
            </span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-950">{guidance.title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{guidance.body}</p>
          <p className="mt-3 text-sm text-slate-600">{guidance.helper}</p>
        </div>
        <div className="min-w-52 rounded-2xl border border-white/80 bg-white/80 px-4 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">次アクション</p>
          <p className="mt-2 leading-7">{guidance.nextAction}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr,0.9fr]">
        <article className="rounded-2xl border border-white/80 bg-white/80 p-4">
          <p className="text-sm font-semibold text-slate-950">想定課題</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {guidance.issues.map((issue) => (
              <li key={issue} className="rounded-xl bg-slate-50 px-3 py-3">{issue}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-white/80 bg-white/80 p-4">
          <p className="text-sm font-semibold text-slate-950">ガイド</p>
          <div className="mt-3 flex flex-col gap-2">
            {guidance.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
