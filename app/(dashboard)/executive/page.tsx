import Link from "next/link";

import { SessionActionButton } from "@/components/auth/session-action-button";
import { AnnualTrendChart } from "@/components/pl/annual-trend-chart";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getExecutiveDashboardBundle } from "@/lib/executive/executive-dashboard-service";

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function parseNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ yearMonth?: string; fiscalYear?: string; fiscalStartMonth?: string; evaluationPeriodId?: string }>;
}) {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.plAllRead);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-6 py-16 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-10 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h1 className="text-3xl font-semibold">トップ経営ダッシュボード</h1>
          <p className="mt-3 text-slate-600">この画面は全社閲覧権限を持つ管理者または役員向けです。</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            月次ダッシュボードへ戻る
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const bundle = await getExecutiveDashboardBundle({
    yearMonth: params.yearMonth,
    fiscalYear: parseNumber(params.fiscalYear),
    fiscalStartMonth: parseNumber(params.fiscalStartMonth),
    evaluationPeriodId: params.evaluationPeriodId,
  });

  const annualTrendPoints = bundle.annualComparisonRows.slice().reverse().map((row) => ({
    label: `${row.fiscalYear}年度`,
    primaryValue: row.salesTotal,
    secondaryValue: row.finalGrossProfit,
  }));

  const kpis = [
    { label: `月次売上 (${bundle.yearMonth})`, value: formatNumber(bundle.monthlyTotals.salesTotal), unit: "円" },
    { label: `月次最終粗利 (${bundle.yearMonth})`, value: formatNumber(bundle.monthlyTotals.finalGrossProfit), unit: "円" },
    { label: `年度売上 (${bundle.fiscalYear}年度)`, value: formatNumber(bundle.annualTotals.salesTotal), unit: "円" },
    { label: `年度最終粗利 (${bundle.fiscalYear}年度)`, value: formatNumber(bundle.annualTotals.finalGrossProfit), unit: "円" },
    { label: "評価確定数", value: `${bundle.evaluationTotals.finalizedCount} / ${bundle.evaluationTotals.totalCount}`, unit: "名" },
    { label: "昇給案合計", value: formatNumber(bundle.salaryTotals.totalRaiseAmount), unit: "円" },
  ];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8ee_0%,#f3f7ff_55%,#ecfdf5_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-[linear-gradient(135deg,#111827_0%,#1f2937_44%,#0f766e_100%)] px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-amber-200">Executive Overview</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">トップ経営ダッシュボード</h1>
              <p className="mt-2 text-sm text-slate-200">月次収益、年度推移、評価、昇給を1画面で俯瞰できます。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                ログイン切替
              </Link>
              <SessionActionButton
                mode="logout"
                redirectTo="/login"
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white"
              >
                ログアウト
              </SessionActionButton>
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月次ダッシュボードへ
              </Link>
              <Link href="/pl/annual" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                年度ダッシュボードへ
              </Link>
              <Link href="/salary/simulations" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                昇給シミュレーションへ
              </Link>
            </div>
          </div>

          <form method="get" className="mt-5 grid gap-4 rounded-[1.5rem] bg-white/10 p-4 md:grid-cols-4 md:items-end">
            <label className="text-sm text-white">
              月次表示月
              <select name="yearMonth" defaultValue={bundle.yearMonth} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.yearMonthOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-white">
              年度
              <select name="fiscalYear" defaultValue={String(bundle.fiscalYear)} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.fiscalYearOptions.map((option) => (
                  <option key={option.fiscalYear} value={option.fiscalYear}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-white">
              年度開始月
              <select name="fiscalStartMonth" defaultValue={String(bundle.fiscalStartMonth)} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.fiscalStartMonthOptions.map((option) => (
                  <option key={option.month} value={option.month}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-white">
              評価期間
              <select name="evaluationPeriodId" defaultValue={bundle.evaluationPeriodId} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.evaluationPeriodOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="md:col-span-4 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
              表示更新
            </button>
          </form>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <p className="text-sm text-slate-500">{kpi.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{kpi.value}<span className="ml-2 text-sm font-medium text-slate-500">{kpi.unit}</span></p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <AnnualTrendChart
            title="全社年度推移"
            subtitle="売上と最終粗利の推移です。"
            primaryLabel="売上"
            secondaryLabel="最終粗利"
            points={annualTrendPoints}
            primaryColor="#c2410c"
            secondaryColor="#0f766e"
          />
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">経営アラート</h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-rose-50 p-4">
                <p className="text-sm font-medium text-rose-700">月次差異ワーストチーム</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{bundle.monthlyTeamRows[0]?.teamName ?? "-"}</p>
                <p className="mt-1 text-sm text-slate-600">差異 {bundle.monthlyTeamRows[0]?.varianceRate ?? 0}pt</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-700">年度粗利率差異</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{bundle.annualTotals.varianceRate} pt</p>
                <p className="mt-1 text-sm text-slate-600">全社年度の目標との差です。</p>
              </div>
              <div className="rounded-2xl bg-sky-50 p-4">
                <p className="text-sm font-medium text-sky-700">昇給承認状況</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">承認 {bundle.salaryTotals.approvedCount}件 / 反映 {bundle.salaryTotals.appliedCount}件</p>
                <p className="mt-1 text-sm text-slate-600">下書き {bundle.salaryTotals.draftCount}件</p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">月次チーム差異一覧</h2>
                <p className="mt-1 text-sm text-slate-500">差異が大きい順に並べています。</p>
              </div>
              <Link href={`/dashboard?yearMonth=${bundle.yearMonth}`} className="text-sm font-medium text-orange-700">
                月次ダッシュボードへ
              </Link>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">チーム</th>
                    <th className="px-4 py-3 font-medium">売上</th>
                    <th className="px-4 py-3 font-medium">最終粗利</th>
                    <th className="px-4 py-3 font-medium">実績率</th>
                    <th className="px-4 py-3 font-medium">差異</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.monthlyTeamRows.map((row) => (
                    <tr key={`${row.teamId}-${bundle.yearMonth}`} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-950">
                        <Link href={`/pl/monthly?teamId=${row.teamId}&yearMonth=${bundle.yearMonth}`} className="text-orange-700 underline-offset-4 hover:underline">
                          {row.teamName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatNumber(row.salesTotal)} 円</td>
                      <td className="px-4 py-3 text-slate-700">{formatNumber(row.finalGrossProfit)} 円</td>
                      <td className="px-4 py-3 text-slate-700">{row.actualGrossProfitRate}%</td>
                      <td className={`px-4 py-3 font-semibold ${row.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.varianceRate >= 0 ? "+" : ""}{row.varianceRate}pt</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">評価・昇給サマリー</h2>
            <div className="mt-5 space-y-4">
              {bundle.evaluationPeriodRows.map((row) => (
                <div key={row.evaluationPeriodId} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{row.periodName}</p>
                      <p className="mt-1 text-sm text-slate-500">評価確定 {row.finalizedCount} / {row.totalCount}</p>
                    </div>
                    <Link href={`/salary/simulations?evaluationPeriodId=${row.evaluationPeriodId}`} className="text-sm font-medium text-orange-700">
                      詳細
                    </Link>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-slate-500">平均参考評価点</p>
                      <p className="mt-1 font-semibold text-slate-950">{row.averageFinalScore}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-slate-500">昇給案合計</p>
                      <p className="mt-1 font-semibold text-slate-950">{formatNumber(row.proposedRaiseAmountTotal)} 円</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
