import Link from "next/link";

import { AnnualTrendChart } from "@/components/pl/annual-trend-chart";
import { getSessionUser } from "@/lib/auth/demo-session";
import { formatCurrency } from "@/lib/format/currency";
import { getPersonalAnnualProfitByUser } from "@/lib/pl/personal-profit-service";

function parseNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function PersonalAnnualPage({
  searchParams,
}: {
  searchParams: Promise<{ fiscalYear?: string; fiscalStartMonth?: string; rangeStartYearMonth?: string; rangeEndYearMonth?: string }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const bundle = await getPersonalAnnualProfitByUser(
    user.id,
    parseNumber(params.fiscalYear),
    parseNumber(params.fiscalStartMonth),
    params.rangeStartYearMonth,
    params.rangeEndYearMonth,
  );

  if (!bundle) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbf8_0%,#edf6ef_100%)] px-6 py-16 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-10 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h1 className="text-3xl font-semibold">個人年度ダッシュボード</h1>
          <p className="mt-3 text-slate-600">表示できる個人年度データがありません。</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            月次ダッシュボードへ戻る
          </Link>
        </div>
      </main>
    );
  }

  const trendPoints = bundle.months.map((row) => ({
    label: row.yearMonth,
    primaryValue: row.salesTotal,
    secondaryValue: row.finalGrossProfit,
  }));

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbf8_0%,#edf6ef_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-emerald-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(6,78,59,0.24)]">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">Personal Annual Dashboard</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">個人年度ダッシュボード</h1>
              <p className="mt-2 text-sm text-emerald-100">{bundle.userName} / {bundle.departmentName} / {bundle.fiscalYearLabel}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月次ダッシュボードへ
              </Link>
              <Link href="/pl/annual" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                年度ダッシュボードへ
              </Link>
            </div>
          </div>
          <form method="get" className="mt-5 grid gap-4 rounded-[1.5rem] bg-white/10 p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
            <label className="text-sm text-emerald-50">
              年度
              <select name="fiscalYear" defaultValue={String(bundle.fiscalYear)} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.options.map((option) => (
                  <option key={option.fiscalYear} value={option.fiscalYear}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-emerald-50">
              年度開始月
              <select name="fiscalStartMonth" defaultValue={String(bundle.fiscalStartMonth)} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.fiscalStartMonthOptions.map((option) => (
                  <option key={option.month} value={option.month}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-emerald-50">
              開始月
              <select name="rangeStartYearMonth" defaultValue={bundle.rangeStartYearMonth} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.yearMonthOptions.map((option) => (
                  <option key={`start-${option.yearMonth}`} value={option.yearMonth}>{option.yearMonth}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-emerald-50">
              終了月
              <select name="rangeEndYearMonth" defaultValue={bundle.rangeEndYearMonth} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.yearMonthOptions.map((option) => (
                  <option key={`end-${option.yearMonth}`} value={option.yearMonth}>{option.yearMonth}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-950">
              表示更新
            </button>
          </form>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">年度売上</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(bundle.totals.salesTotal)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">年度人件費</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(bundle.totals.directLaborCost)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">年度固定費按分</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(bundle.totals.fixedCostAllocation)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">年度最終粗利</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(bundle.totals.finalGrossProfit)}<span className="ml-2 text-sm font-medium text-slate-500">円</span></p>
            <p className={`mt-2 text-sm font-medium ${bundle.totals.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>差異 {bundle.totals.varianceRate >= 0 ? "+" : ""}{bundle.totals.varianceRate}pt</p>
          </article>
        </section>

        <section className="mt-8">
          <AnnualTrendChart
            title="個人年度推移"
            subtitle="月別の売上と最終粗利です。"
            primaryLabel="売上"
            secondaryLabel="最終粗利"
            points={trendPoints}
            primaryColor="#0f766e"
            secondaryColor="#1d4ed8"
          />
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold text-slate-950">月別一覧</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">月</th>
                  <th className="px-4 py-3 font-medium">売上</th>
                  <th className="px-4 py-3 font-medium">人件費</th>
                  <th className="px-4 py-3 font-medium">固定費按分</th>
                  <th className="px-4 py-3 font-medium">最終粗利</th>
                  <th className="px-4 py-3 font-medium">目標率</th>
                  <th className="px-4 py-3 font-medium">実績率</th>
                  <th className="px-4 py-3 font-medium">差異</th>
                </tr>
              </thead>
              <tbody>
                {bundle.months.map((row) => (
                  <tr key={row.yearMonth} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-950">{row.yearMonth}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.salesTotal)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.directLaborCost)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.fixedCostAllocation)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.finalGrossProfit)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.targetGrossProfitRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{row.actualGrossProfitRate}%</td>
                    <td className={`px-4 py-3 font-semibold ${row.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.varianceRate >= 0 ? "+" : ""}{row.varianceRate}pt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
