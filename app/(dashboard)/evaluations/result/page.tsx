import Link from "next/link";

import { getSessionUser } from "@/lib/auth/demo-session";
import { isUserMenuEnabled } from "@/lib/menu-visibility/menu-visibility-service";
import { getFinalReviewBundle } from "@/lib/evaluations/final-review-service";
import { getEvaluationPeriodOptions } from "@/lib/evaluations/period-service";
import { getSalaryResultDetailBundle } from "@/lib/salary-simulations/salary-simulation-service";
import { formatCurrencyWithUnit, formatSignedCurrencyWithUnit } from "@/lib/format/currency";

function formatCurrency(value: number) {
  return formatCurrencyWithUnit(value);
}

function formatPercent(value: number) {
  return `${value}%`;
}

function toStatusLabel(status: string) {
  switch (status) {
    case "APPLIED":
      return "反映済み";
    case "APPROVED":
      return "承認済み";
    default:
      return "未確定";
  }
}

function getDisplayStageLabel(stage: "SELF" | "MANAGER" | "FINAL") {
  switch (stage) {
    case "FINAL":
      return "最終確定結果";
    case "MANAGER":
      return "上長評価ベースの暫定結果";
    case "SELF":
    default:
      return "自己評価ベースの暫定結果";
  }
}

function toStatusTone(status: string) {
  switch (status) {
    case "APPLIED":
      return "bg-emerald-50 text-emerald-700";
    case "APPROVED":
      return "bg-sky-50 text-sky-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

export default async function EvaluationResultPage({
  searchParams,
}: {
  searchParams: Promise<{ evaluationPeriodId?: string }>;
}) {
  const user = await getSessionUser();
  const philosophyPracticeEnabled = await isUserMenuEnabled(user.id, "philosophyPractice", user.role);
  const params = await searchParams;

  if (!philosophyPracticeEnabled) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">理念実践管理の対象外です</h1>
          <p className="mt-3 text-sm text-slate-600">この機能は現在のメニュー設定では利用対象外です。必要に応じて管理者へご相談ください。</p>
        </div>
      </main>
    );
  }
  const periods = await getEvaluationPeriodOptions();
  const finalReview = await getFinalReviewBundle(user.id, params.evaluationPeriodId);
  const salaryResult = await getSalaryResultDetailBundle(user.id, params.evaluationPeriodId).catch(() => null);
  const salaryRow = salaryResult?.row;
  const displaySalaryRow = salaryRow
    ? salaryRow
    : {
        status: "DRAFT",
        gradeBaseAmount: finalReview.gradeBaseAmount,
        selfGrowthPoint: finalReview.selfGrowthPoint,
        synergyPoint: finalReview.synergyPoint,
        totalGradePoint: finalReview.totalGradePoint,
        pointUnitAmount: finalReview.pointUnitAmount,
        gradeSalaryAmount: finalReview.gradeSalaryAmount,
        currentSalary: finalReview.currentSalary,
      };
  const hasFinalizedAnnualRaise = salaryRow ? salaryRow.status !== "DRAFT" : false;
  const selfGrowthSalaryAmount = displaySalaryRow.gradeBaseAmount + displaySalaryRow.selfGrowthPoint * displaySalaryRow.pointUnitAmount;
  const synergySalaryAmount = displaySalaryRow.synergyPoint * displaySalaryRow.pointUnitAmount;
  const referenceSalaryDiffAmount = displaySalaryRow.gradeSalaryAmount - displaySalaryRow.currentSalary;
  const latestEvidenceItems = finalReview.items.filter((item) => item.axis === "SYNERGY" && item.evidences.length > 0);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">My Result</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">マイ評価結果</h1>
              <p className="mt-2 text-sm text-slate-300">
                半期の評価結果と、年1回の昇給結果をまとめて確認できます。
              </p>
              <p className="mt-2 text-sm text-amber-200">{getDisplayStageLabel(finalReview.displayStage)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {periods.map((period) => {
                  const active = period.id === finalReview.evaluationPeriodId;
                  return (
                    <Link
                      key={period.id}
                      href={`/evaluations/result?evaluationPeriodId=${period.id}`}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "border border-brand-300 bg-brand-200 text-black shadow-sm font-semibold" : "border border-slate-200 bg-white/90 text-black"}`}
                    >
                      <span style={{ color: "#000000" }}>{period.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/evaluations/my" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                自己評価
              </Link>
              <Link href={`/evaluations/finalize?evaluationPeriodId=${finalReview.evaluationPeriodId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                最終評価詳細
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">自律成長力達成率</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatPercent(finalReview.selfGrowthProgress)}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">協調相乗力実施率</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatPercent(finalReview.synergyProgress)}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">自律成長力</p><p className="mt-3 text-2xl font-semibold text-slate-950">S{displaySalaryRow.selfGrowthPoint}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">協調相乗力</p><p className="mt-3 text-2xl font-semibold text-slate-950">B{displaySalaryRow.synergyPoint}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">総合評価</p><p className="mt-3 text-2xl font-semibold text-slate-950">G{displaySalaryRow.totalGradePoint}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">期待充足ランク</p><p className="mt-3 text-2xl font-semibold text-slate-950">{finalReview.finalRating}</p></article>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">参考本給額</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                評価点から計算した参考本給額を表示します。年次昇給の確定前でも、自律成長力と協調相乗力の積み上がりを金額で確認できます。
              </p>
            </div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toStatusTone(salaryRow?.status ?? "DRAFT")}`}>
              {toStatusLabel(salaryRow?.status ?? "DRAFT")}
            </span>
          </div>

          {!salaryRow ? (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">参考本給額</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(displaySalaryRow.gradeSalaryAmount)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">現本給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(displaySalaryRow.currentSalary)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">現給差額</p><p className={`mt-3 text-2xl font-semibold ${referenceSalaryDiffAmount === 0 ? "text-slate-950" : referenceSalaryDiffAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(referenceSalaryDiffAmount)}</p><p className="mt-1 text-sm text-slate-500">参考本給額 {formatCurrency(displaySalaryRow.gradeSalaryAmount)} - 現在本給 {formatCurrency(displaySalaryRow.currentSalary)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">自己成長給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(selfGrowthSalaryAmount)}</p><p className="mt-1 text-sm text-slate-500">ベース {formatCurrency(displaySalaryRow.gradeBaseAmount)} + S{displaySalaryRow.selfGrowthPoint} × {formatCurrency(displaySalaryRow.pointUnitAmount)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">協調相乗給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(synergySalaryAmount)}</p><p className="mt-1 text-sm text-slate-500">B{displaySalaryRow.synergyPoint} × {formatCurrency(displaySalaryRow.pointUnitAmount)}</p></article>
              <div className="md:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                年次昇給結果はまだ作成されていません。ここでは {getDisplayStageLabel(finalReview.displayStage)} をもとにした暫定参考額を表示しています。
              </div>
            </div>
          ) : !hasFinalizedAnnualRaise ? (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">参考本給額</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(salaryRow.gradeSalaryAmount)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">現本給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(salaryRow.baseSalaryReference)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">粗利補正</p><p className="mt-3 text-2xl font-semibold text-slate-950">{salaryRow.grossProfitMultiplier} 倍</p><p className="mt-1 text-sm text-slate-500">粗利達成率 {formatPercent(salaryRow.grossProfitAchievementRate)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">自己成長給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(selfGrowthSalaryAmount)}</p><p className="mt-1 text-sm text-slate-500">ベース {formatCurrency(salaryRow.gradeBaseAmount)} + S{salaryRow.selfGrowthPoint} × {formatCurrency(salaryRow.pointUnitAmount)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">協調相乗給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(synergySalaryAmount)}</p><p className="mt-1 text-sm text-slate-500">B{salaryRow.synergyPoint} × {formatCurrency(salaryRow.pointUnitAmount)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">現給差額</p><p className={`mt-3 text-2xl font-semibold ${referenceSalaryDiffAmount === 0 ? "text-slate-950" : referenceSalaryDiffAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(referenceSalaryDiffAmount)}</p><p className="mt-1 text-sm text-slate-500">参考本給額 {formatCurrency(salaryRow.gradeSalaryAmount)} - 現在本給 {formatCurrency(salaryRow.currentSalary)}</p></article>
              <div className="md:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                年次昇給はまだ確定していません。ここでは参考値のみ表示しています。決定額は承認後に反映されます。
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">参考本給額</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(salaryRow.gradeSalaryAmount)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">決定額</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(salaryRow.newSalary)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">自己成長給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(selfGrowthSalaryAmount)}</p><p className="mt-1 text-sm text-slate-500">ベース {formatCurrency(salaryRow.gradeBaseAmount)} + S{salaryRow.selfGrowthPoint} × {formatCurrency(salaryRow.pointUnitAmount)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">協調相乗給</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(synergySalaryAmount)}</p><p className="mt-1 text-sm text-slate-500">B{salaryRow.synergyPoint} × {formatCurrency(salaryRow.pointUnitAmount)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">現給差額</p><p className={`mt-3 text-2xl font-semibold ${referenceSalaryDiffAmount === 0 ? "text-slate-950" : referenceSalaryDiffAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(referenceSalaryDiffAmount)}</p><p className="mt-1 text-sm text-slate-500">参考本給額 {formatCurrency(salaryRow.gradeSalaryAmount)} - 現在本給 {formatCurrency(salaryRow.currentSalary)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">昇給額</p><p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(salaryRow.proposedRaiseAmount)}</p><p className="mt-1 text-sm text-slate-500">昇給率 {formatPercent(salaryRow.proposedRaiseRate)}</p></article>
              <div className="xl:col-span-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">新しい等級・給与計算</p>
                <p className="mt-2">自己成長給 {formatCurrency(selfGrowthSalaryAmount)} + 協調相乗給 {formatCurrency(synergySalaryAmount)} = 参考本給額 {formatCurrency(salaryRow.gradeSalaryAmount)}</p>
              </div>
              <div className="xl:col-span-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">調整理由</p>
                <p className="mt-2 leading-7">{salaryRow.adjustmentReason || "調整理由は登録されていません。"}</p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.35fr,0.85fr]">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">評価コメント</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">自己コメント</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{finalReview.selfComment || "コメントはありません。"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">上長コメント</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{finalReview.managerComment || "コメントはありません。"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">最終コメント</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{finalReview.finalComment || "コメントはありません。"}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">協調相乗力の根拠</h2>
            <div className="mt-4 space-y-4">
              {latestEvidenceItems.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">今期に登録された根拠はありません。</p>
              ) : (
                latestEvidenceItems.map((item) => (
                  <article key={item.evaluationItemId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.majorCategory}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.title}</h3>
                    <div className="mt-3 space-y-2">
                      {item.evidences.map((evidence, index) => (
                        <div key={`${item.evaluationItemId}-${index}`} className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                          <p className="font-medium text-slate-900">{evidence.summary}</p>
                          {evidence.targetName ? <p className="mt-1 text-xs text-slate-500">対象: {evidence.targetName}</p> : null}
                          {evidence.periodNote ? <p className="mt-2 text-xs text-slate-500">{evidence.periodNote}</p> : null}
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
