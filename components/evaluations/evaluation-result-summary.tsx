import { formatCurrencyWithUnit, formatSignedCurrencyWithUnit } from "@/lib/format/currency";
import type { FinalReviewBundle } from "@/lib/evaluations/final-review-service";

type EvaluationResultSummaryProps = {
  summary: Pick<
    FinalReviewBundle,
    | "selfGrowthProgress"
    | "synergyProgress"
    | "selfGrowthPoint"
    | "synergyPoint"
    | "totalGradePoint"
    | "finalRating"
    | "gradeBaseAmount"
    | "pointUnitAmount"
    | "gradeSalaryAmount"
    | "currentSalary"
    | "grossProfitVarianceRate"
    | "grossProfitDeductionAmount"
    | "salarySelfGrowthPoint"
    | "salarySynergyPoint"
  >;
};

function formatPercent(value: number) {
  return `${value}%`;
}

function formatFinalRatingLabel(value: string) {
  switch (value) {
    case "A":
      return "役割期待を上回っている";
    case "B":
      return "役割期待通り";
    case "C":
      return "役割期待に不足がある";
    case "-":
      return "未";
    default:
      return value;
  }
}

export function EvaluationResultSummary({ summary }: EvaluationResultSummaryProps) {
  const selfGrowthSalaryAmount = summary.gradeBaseAmount + summary.salarySelfGrowthPoint * summary.pointUnitAmount;
  const synergySalaryAmount = summary.salarySynergyPoint * summary.pointUnitAmount;
  const referenceSalaryDiffAmount = summary.gradeSalaryAmount - summary.currentSalary;
  const displayedFinalRating = formatFinalRatingLabel(summary.finalRating);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">自律成長力達成率</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatPercent(summary.selfGrowthProgress)}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">協調相乗力実施率</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatPercent(summary.synergyProgress)}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">自律成長力</p><p className="mt-3 text-2xl font-semibold text-slate-950">S{summary.selfGrowthPoint}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">協調相乗力</p><p className="mt-3 text-2xl font-semibold text-slate-950">B{summary.synergyPoint}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">総合評価</p><p className="mt-3 text-2xl font-semibold text-slate-950">G{summary.totalGradePoint}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">期待充足ランク</p><p className="mt-3 text-2xl font-semibold text-slate-950">{displayedFinalRating}</p></article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">現本給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrencyWithUnit(summary.currentSalary)}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">自律成長評価</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrencyWithUnit(selfGrowthSalaryAmount)}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">協調相乗評価</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrencyWithUnit(synergySalaryAmount)}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">粗利差異率</p><p className={`mt-3 text-2xl font-semibold ${summary.grossProfitVarianceRate < 0 ? "text-rose-700" : summary.grossProfitVarianceRate > 0 ? "text-emerald-700" : "text-slate-950"}`}>{formatPercent(summary.grossProfitVarianceRate)}</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">粗利差額配分</p><p className={`mt-3 text-2xl font-semibold ${summary.grossProfitDeductionAmount < 0 ? "text-rose-700" : summary.grossProfitDeductionAmount > 0 ? "text-emerald-700" : "text-slate-950"}`}>{formatSignedCurrencyWithUnit(summary.grossProfitDeductionAmount)}</p><p className="mt-1 text-sm text-slate-500">目標粗利との差額を配分する場合の目安金額です。</p></article>
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] md:col-span-2 xl:col-span-6"><p className="text-sm text-slate-500">現給差額</p><p className={`mt-3 text-2xl font-semibold ${referenceSalaryDiffAmount === 0 ? "text-slate-950" : referenceSalaryDiffAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(referenceSalaryDiffAmount)}</p><p className="mt-1 text-sm text-slate-500">参考評価額 {formatCurrencyWithUnit(summary.gradeSalaryAmount)} - 現在本給 {formatCurrencyWithUnit(summary.currentSalary)}</p></article>
      </section>
    </div>
  );
}
