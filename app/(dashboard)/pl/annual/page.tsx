import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { AnnualEvaluationSummaryExportButton } from "@/components/evaluations/annual-evaluation-summary-export-button";
import { AnnualTrendChart } from "@/components/pl/annual-trend-chart";
import { AnnualDashboardExportButton } from "@/components/pl/annual-dashboard-export-button";
import { getAnnualDashboardBundle } from "@/lib/pl/annual-service";
import { getAnnualEvaluationSummaryBundle } from "@/lib/evaluations/annual-summary-service";
import { formatCurrency } from "@/lib/format/currency";


function parseNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function AnnualPlPage({
  searchParams,
}: {
  searchParams: Promise<{ fiscalYear?: string; fiscalStartMonth?: string; selectedTeamId?: string; rangeStartYearMonth?: string; rangeEndYearMonth?: string }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const canViewAll = hasPermission(user, PERMISSIONS.plAllRead);
  const canManageSalary = hasPermission(user, PERMISSIONS.salaryRead);

  if (!canViewAll && user.teamIds.length === 0) {
    redirect("/pl/annual-personal");
  }
  const visibleTeamIds = canViewAll ? undefined : user.teamIds;
  const bundle = await getAnnualDashboardBundle(
    parseNumber(params.fiscalYear),
    parseNumber(params.fiscalStartMonth),
    visibleTeamIds,
    params.selectedTeamId,
    params.rangeStartYearMonth,
    params.rangeEndYearMonth,
  );
  const evaluationSummary = await getAnnualEvaluationSummaryBundle(bundle.fiscalYear, bundle.fiscalStartMonth, visibleTeamIds);
  const rankingBySales = [...bundle.summaries].sort((a, b) => b.salesTotal - a.salesTotal).slice(0, 3);
  const rankingByGrossProfit = [...bundle.summaries].sort((a, b) => b.finalGrossProfit - a.finalGrossProfit).slice(0, 3);
  const rankingByVariance = [...bundle.summaries].sort((a, b) => b.varianceRate - a.varianceRate).slice(0, 3);
  const companyTrendPoints = bundle.comparisonRows.slice().reverse().map((row) => ({
    label: `${row.fiscalYear}年度`,
    primaryValue: row.salesTotal,
    secondaryValue: row.finalGrossProfit,
  }));
  const teamTrendPoints = bundle.teamComparisonRows.slice().reverse().map((row) => ({
    label: `${row.fiscalYear}年度`,
    primaryValue: row.finalGrossProfit,
    secondaryValue: row.varianceRate,
  }));

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbf8_0%,#edf6ef_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-emerald-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(6,78,59,0.24)]">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">Annual Dashboard</p>
          <div className="mt-3 flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold">年度ダッシュボード</h1>
                <p className="mt-2 text-sm text-emerald-100">指定年度の累計実績を、前年度同一期間と比較して確認できます。</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <AnnualDashboardExportButton
                  fiscalYearLabel={`${bundle.fiscalYear}年度`}
                  fiscalStartMonthLabel={bundle.fiscalStartMonthLabel}
                  rows={bundle.summaries}
                />
                <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                  月次ダッシュボードへ
                </Link>
                <Link
                  href={`/pl/monthly?yearMonth=${bundle.coveredMonths[bundle.coveredMonths.length - 1] ?? `${bundle.fiscalYear}-${String(bundle.fiscalStartMonth).padStart(2, "0")}`}`}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                >
                  月次PL詳細へ
                </Link>
              </div>
            </div>

            <form method="get" className="grid gap-4 rounded-[1.5rem] bg-white/10 p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] sm:items-end">
              <label className="text-sm text-emerald-50">
                年度
                <select
                  name="fiscalYear"
                  defaultValue={String(bundle.fiscalYear)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                >
                  {bundle.options.map((option) => (
                    <option key={option.fiscalYear} value={option.fiscalYear}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-emerald-50">
                年度開始月
                <select
                  name="fiscalStartMonth"
                  defaultValue={String(bundle.fiscalStartMonth)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                >
                  {bundle.fiscalStartMonthOptions.map((option) => (
                    <option key={option.month} value={option.month}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-emerald-50">
                開始月
                <select
                  name="rangeStartYearMonth"
                  defaultValue={bundle.rangeStartYearMonth}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                >
                  {bundle.rangeOptions.map((option) => (
                    <option key={`start-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-emerald-50">
                終了月
                <select
                  name="rangeEndYearMonth"
                  defaultValue={bundle.rangeEndYearMonth}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                >
                  {bundle.rangeOptions.map((option) => (
                    <option key={`end-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-emerald-50">
                比較チーム
                <select
                  name="selectedTeamId"
                  defaultValue={bundle.selectedTeamId ?? ""}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                >
                  {bundle.summaries.map((row) => (
                    <option key={row.teamId} value={row.teamId}>
                      {row.teamName}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-950">
                表示更新
              </button>
            </form>

          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">年度売上合計</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(bundle.totals.salesTotal)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
            <p className={`mt-2 text-sm font-medium ${bundle.totals.salesYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              前年同期比 {bundle.totals.salesYoYRate >= 0 ? "+" : ""}{bundle.totals.salesYoYRate}%
            </p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">年度最終粗利</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(bundle.totals.finalGrossProfit)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
            <p className={`mt-2 text-sm font-medium ${bundle.totals.grossProfitYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              前年同期比 {bundle.totals.grossProfitYoYRate >= 0 ? "+" : ""}{bundle.totals.grossProfitYoYRate}%
            </p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">年度粗利率</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{bundle.totals.grossProfitRate}<span className="ml-2 text-sm font-medium text-slate-500">%</span></p>
            <p className="mt-2 text-sm text-slate-500">目標 {bundle.totals.targetGrossProfitRate}%</p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">目標差異</p>
            <p className={`mt-3 text-3xl font-semibold ${bundle.totals.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{bundle.totals.varianceRate}<span className="ml-2 text-sm font-medium text-slate-500">pt</span></p>
            <p className="mt-2 text-sm text-slate-500">対象: {bundle.fiscalYearLabel}</p>
          </article>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <AnnualTrendChart
            title="全社年度推移"
            subtitle="選択年度と前年度同一期間の比較です。"
            primaryLabel="売上"
            secondaryLabel="最終粗利"
            points={companyTrendPoints}
            primaryColor="#0f766e"
            secondaryColor="#1d4ed8"
          />
          <AnnualTrendChart
            title="チーム別年度推移"
            subtitle={`${bundle.selectedTeamName ?? "選択チーム"} の前年度同一期間比較です。`}
            primaryLabel="最終粗利"
            secondaryLabel="目標差異"
            points={teamTrendPoints}
            primaryColor="#059669"
            secondaryColor="#f59e0b"
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-3">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-slate-950">売上ランキング</h2>
            <div className="mt-4 space-y-3">
              {rankingBySales.map((team, index) => (
                <div key={`${team.teamId}-sales`} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">#{index + 1}</p>
                  <p className="mt-1 font-semibold text-slate-950"><span style={{ color: "#000000" }}>{team.teamName}</span></p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(team.salesTotal)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
                  <p className={`mt-1 text-sm font-medium ${team.salesYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>前年同期比 {team.salesYoYRate >= 0 ? "+" : ""}{team.salesYoYRate}%</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-slate-950">最終粗利ランキング</h2>
            <div className="mt-4 space-y-3">
              {rankingByGrossProfit.map((team, index) => (
                <div key={`${team.teamId}-gross`} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">#{index + 1}</p>
                  <p className="mt-1 font-semibold text-slate-950"><span style={{ color: "#000000" }}>{team.teamName}</span></p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(team.finalGrossProfit)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
                  <p className={`mt-1 text-sm font-medium ${team.grossProfitYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>前年同期比 {team.grossProfitYoYRate >= 0 ? "+" : ""}{team.grossProfitYoYRate}%</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-slate-950">目標差異ランキング</h2>
            <div className="mt-4 space-y-3">
              {rankingByVariance.map((team, index) => (
                <div key={`${team.teamId}-variance`} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">#{index + 1}</p>
                  <p className="mt-1 font-semibold text-slate-950"><span style={{ color: "#000000" }}>{team.teamName}</span></p>
                  <p className={`mt-2 text-xl font-semibold ${team.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{team.varianceRate >= 0 ? "+" : ""}{team.varianceRate}<span className="ml-2 text-sm font-medium text-slate-500">pt</span></p>
                  <p className="mt-1 text-sm text-slate-500">粗利率 {team.grossProfitRate}% / 目標 {team.targetGrossProfitRate}%</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">チーム別年度サマリー</h2>
              <p className="mt-1 text-sm text-slate-500">対象月: {bundle.rangeStartYearMonth} 〜 {bundle.rangeEndYearMonth}</p>
              <p className="mt-1 text-sm text-slate-500">前年同期: {bundle.previousCoveredMonths.join(" / ")}</p>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">チーム</th>
                  <th className="px-4 py-3 font-medium">年度売上</th>
                  <th className="px-4 py-3 font-medium">売上前年同期比</th>
                  <th className="px-4 py-3 font-medium">年度最終粗利</th>
                  <th className="px-4 py-3 font-medium">粗利前年同期比</th>
                  <th className="px-4 py-3 font-medium">年度粗利率</th>
                  <th className="px-4 py-3 font-medium">目標粗利率</th>
                  <th className="px-4 py-3 font-medium">差異</th>
                </tr>
              </thead>
              <tbody>
                {bundle.summaries.map((row) => (
                  <tr key={`${row.teamId}-${row.fiscalYear}-${row.fiscalStartMonth}`} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-950">
                      <Link
                        href={`/pl/monthly?teamId=${row.teamId}&yearMonth=${row.coveredMonths[row.coveredMonths.length - 1] ?? bundle.coveredMonths[bundle.coveredMonths.length - 1]}`}
                        className="text-emerald-700 underline-offset-4 hover:underline"
                      >
                        {row.teamName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.salesTotal)} 円</td>
                    <td className={`px-4 py-3 font-semibold ${row.salesYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.salesYoYRate >= 0 ? "+" : ""}{row.salesYoYRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.finalGrossProfit)} 円</td>
                    <td className={`px-4 py-3 font-semibold ${row.grossProfitYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.grossProfitYoYRate >= 0 ? "+" : ""}{row.grossProfitYoYRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{row.grossProfitRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{row.targetGrossProfitRate}%</td>
                    <td className={`px-4 py-3 font-semibold ${row.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.varianceRate >= 0 ? "+" : ""}{row.varianceRate}pt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">チーム別年度推移</h2>
              <p className="mt-1 text-sm text-slate-500">{bundle.selectedTeamName ?? "チーム未選択"} の年度比較です。</p>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">年度</th>
                  <th className="px-4 py-3 font-medium">売上</th>
                  <th className="px-4 py-3 font-medium">売上前年同期比</th>
                  <th className="px-4 py-3 font-medium">最終粗利</th>
                  <th className="px-4 py-3 font-medium">粗利前年同期比</th>
                  <th className="px-4 py-3 font-medium">粗利率</th>
                  <th className="px-4 py-3 font-medium">目標率</th>
                  <th className="px-4 py-3 font-medium">差異</th>
                </tr>
              </thead>
              <tbody>
                {bundle.teamComparisonRows.map((row) => (
                  <tr key={`team-comparison-${row.teamId}-${row.fiscalYear}`} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-950">{row.fiscalYear}年度</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.salesTotal)} 円</td>
                    <td className={`px-4 py-3 font-semibold ${row.salesYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.salesYoYRate >= 0 ? "+" : ""}{row.salesYoYRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.finalGrossProfit)} 円</td>
                    <td className={`px-4 py-3 font-semibold ${row.grossProfitYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.grossProfitYoYRate >= 0 ? "+" : ""}{row.grossProfitYoYRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{row.grossProfitRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{row.targetGrossProfitRate}%</td>
                    <td className={`px-4 py-3 font-semibold ${row.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.varianceRate >= 0 ? "+" : ""}{row.varianceRate}pt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">前年度同一期間比較</h2>
              <p className="mt-1 text-sm text-slate-500">選択年度と前年度の同一期間を比較しています。</p>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">年度</th>
                  <th className="px-4 py-3 font-medium">売上</th>
                  <th className="px-4 py-3 font-medium">売上前年同期比</th>
                  <th className="px-4 py-3 font-medium">最終粗利</th>
                  <th className="px-4 py-3 font-medium">粗利前年同期比</th>
                  <th className="px-4 py-3 font-medium">粗利率</th>
                  <th className="px-4 py-3 font-medium">目標率</th>
                  <th className="px-4 py-3 font-medium">差異</th>
                </tr>
              </thead>
              <tbody>
                {bundle.comparisonRows.map((row) => (
                  <tr key={`comparison-${row.fiscalYear}`} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-950">
                      <Link href={`/pl/annual?fiscalYear=${row.fiscalYear}&fiscalStartMonth=${bundle.fiscalStartMonth}`} className="text-emerald-700 underline-offset-4 hover:underline">
                        {row.fiscalYear}年度
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.salesTotal)} 円</td>
                    <td className={`px-4 py-3 font-semibold ${row.salesYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.salesYoYRate >= 0 ? "+" : ""}{row.salesYoYRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.finalGrossProfit)} 円</td>
                    <td className={`px-4 py-3 font-semibold ${row.grossProfitYoYRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.grossProfitYoYRate >= 0 ? "+" : ""}{row.grossProfitYoYRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{row.grossProfitRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{row.targetGrossProfitRate}%</td>
                    <td className={`px-4 py-3 font-semibold ${row.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.varianceRate >= 0 ? "+" : ""}{row.varianceRate}pt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">年度評価サマリー</h2>
                  </div>
              <AnnualEvaluationSummaryExportButton
                fiscalYearLabel={`${bundle.fiscalYear}年度`}
                fiscalStartMonthLabel={bundle.fiscalStartMonthLabel}
                rows={evaluationSummary.periods}
              />
            </div>
            <p className="mt-1 text-sm text-slate-500">年度内に重なる評価期間を集計しています。</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">評価確定数</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{evaluationSummary.totalEvaluatedCount} / {evaluationSummary.totalTargetCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">平均参考評価点</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{evaluationSummary.averageFinalScore}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">昇給案合計</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(evaluationSummary.proposedRaiseAmountTotal)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">反映済合計</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(evaluationSummary.appliedRaiseAmountTotal)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700">期待充足ランク分布</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.keys(evaluationSummary.ratingCounts).length > 0 ? Object.entries(evaluationSummary.ratingCounts).map(([rating, count]) => (
                  <span key={rating} className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                    {rating}: {count}名
                  </span>
                )) : <span className="text-sm text-slate-500">評価データなし</span>}
              </div>
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">評価期間別の進捗と昇給状況</h2>
                <p className="mt-1 text-sm text-slate-500">年度に含まれる半期評価ごとの状況です。</p>
              </div>
              {canManageSalary ? (
                <Link href="/salary/simulations" className="text-sm font-medium text-emerald-700">
                  昇給決定へ
                </Link>
              ) : null}
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">評価期間</th>
                    <th className="px-4 py-3 font-medium">確定数</th>
                    <th className="px-4 py-3 font-medium">平均参考評価点</th>
                    <th className="px-4 py-3 font-medium">期待充足ランク</th>
                    <th className="px-4 py-3 font-medium">昇給案合計</th>
                    <th className="px-4 py-3 font-medium">昇給状態</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluationSummary.periods.map((period) => (
                    <tr key={period.evaluationPeriodId} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {canManageSalary ? (
                          <Link href={`/salary/simulations?evaluationPeriodId=${period.evaluationPeriodId}`} className="text-emerald-700 underline-offset-4 hover:underline">
                            {period.periodName}
                          </Link>
                        ) : (
                          <span>{period.periodName}</span>
                        )}
                        <p className="mt-1 text-xs text-slate-500">{period.startDate} - {period.endDate}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{period.finalizedCount} / {period.totalCount}</td>
                      <td className="px-4 py-3 text-slate-700">{period.averageFinalScore}</td>
                      <td className="px-4 py-3 text-slate-700">{Object.entries(period.ratingCounts).map(([rating, count]) => `${rating}:${count}`).join(" / ") || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(period.proposedRaiseAmountTotal)} 円</td>
                      <td className="px-4 py-3 text-slate-700">{Object.entries(period.salarySimulationStatusCounts).map(([status, count]) => `${status}:${count}`).join(" / ") || "未作成"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
