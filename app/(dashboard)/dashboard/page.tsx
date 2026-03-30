import Link from "next/link";

import { SessionActionButton } from "@/components/auth/session-action-button";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getEvaluationProgressBundle } from "@/lib/evaluations/progress-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getCompanyTargetGrossProfitRate, getTeamMonthlySnapshot, getVisibleTeamMonthlySnapshots, getVisibleYearMonthOptions } from "@/lib/pl/service";
import { getUnassignedPersonalProfitByUser } from "@/lib/pl/unassigned-profit-service";
import { formatCurrency } from "@/lib/format/currency";


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ yearMonth?: string }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const canViewAll = hasPermission(user, PERMISSIONS.plAllRead);
  const canEditTeam = hasPermission(user, PERMISSIONS.plTeamWrite);
  const canManageSalary = hasPermission(user, PERMISSIONS.salaryRead);
  const canManageFixedCosts = hasPermission(user, PERMISSIONS.masterWrite);
  const yearMonth = params.yearMonth ?? "2026-03";
  const hasPrimaryTeam = user.teamIds.length > 0;
  const showPersonalProfit = !canViewAll && !hasPrimaryTeam;
  const defaultTeamId = hasPrimaryTeam ? user.teamIds[0] : undefined;

  const [snapshots, personalSummary, progress, yearMonthOptions, companyTargetGrossProfitRate] = await Promise.all([
    showPersonalProfit
      ? Promise.resolve([])
      : canViewAll
        ? getVisibleTeamMonthlySnapshots(yearMonth)
        : Promise.resolve([await getTeamMonthlySnapshot(defaultTeamId!, yearMonth)]),
    showPersonalProfit ? getUnassignedPersonalProfitByUser(user.id, yearMonth) : Promise.resolve(null),
    getEvaluationProgressBundle(canViewAll ? undefined : user.teamIds),
    getVisibleYearMonthOptions(showPersonalProfit ? undefined : defaultTeamId),
    showPersonalProfit || !canViewAll ? Promise.resolve(0) : getCompanyTargetGrossProfitRate(yearMonth),
  ]);

  const aggregateSnapshot = !showPersonalProfit && canViewAll
    ? (() => {
        const salesTotal = snapshots.reduce((sum, row) => sum + row.salesTotal, 0);
        const grossProfit1 = snapshots.reduce((sum, row) => sum + row.grossProfit1, 0);
        const finalGrossProfit = snapshots.reduce((sum, row) => sum + row.finalGrossProfit, 0);
        const actualGrossProfitRate = salesTotal === 0 ? 0 : Math.round((finalGrossProfit / salesTotal) * 100 * 100) / 100;
        const varianceRate = Math.round((actualGrossProfitRate - companyTargetGrossProfitRate) * 100) / 100;
        return {
          salesTotal,
          grossProfit1,
          finalGrossProfit,
          varianceRate,
        };
      })()
    : null;

  const primarySnapshot = aggregateSnapshot ?? snapshots[0];

  const summaryCards = showPersonalProfit
    ? [
        { label: "個人売上", value: formatCurrency(personalSummary?.salesTotal ?? 0), unit: "円" },
        { label: "人件費", value: formatCurrency(personalSummary?.directLaborCost ?? 0), unit: "円" },
        { label: "固定費按分", value: formatCurrency(personalSummary?.fixedCostAllocation ?? 0), unit: "円" },
        { label: "最終粗利", value: formatCurrency(personalSummary?.finalGrossProfit ?? 0), unit: "円" },
      ]
    : [
        { label: "売上合計", value: formatCurrency(primarySnapshot?.salesTotal ?? 0), unit: "円" },
        { label: "1次粗利", value: formatCurrency(primarySnapshot?.grossProfit1 ?? 0), unit: "円" },
        { label: "最終粗利", value: formatCurrency(primarySnapshot?.finalGrossProfit ?? 0), unit: "円" },
        { label: "粗利率差異", value: `${primarySnapshot?.varianceRate ?? 0}`, unit: "pt" },
      ];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f7fb_0%,#ecf2ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Monthly Control Center</p>
            <h1 className="mt-3 text-3xl font-semibold">月次ダッシュボード</h1>
            <p className="mt-2 text-sm text-slate-300">
              {user.name} として表示中 / ロール: {user.role} / 表示月: {yearMonth}
            </p>
            <form method="get" className="mt-4 max-w-md">
              <label className="text-sm text-slate-200">
                表示月
                <div className="mt-2 flex flex-wrap gap-3 sm:flex-nowrap">
                  <select
                    name="yearMonth"
                    defaultValue={yearMonth}
                    className="min-w-[11rem] flex-1 rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                  >
                    {yearMonthOptions.map((option) => (
                      <option key={option.yearMonth} value={option.yearMonth}>
                        {option.yearMonth}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="rounded-full bg-brand-300 px-5 py-3 text-sm font-semibold text-slate-950">
                    更新
                  </button>
                </div>
              </label>
            </form>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              ログイン切替
            </Link>
            <SessionActionButton
              mode="logout"
              redirectTo="/login"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              ログアウト
            </SessionActionButton>
            {!showPersonalProfit ? (
              <Link href={`/pl/monthly?yearMonth=${yearMonth}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                月次PL詳細
              </Link>
            ) : null}
            <Link href="/executive" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              トップ経営ダッシュボード
            </Link>
            <Link href="/pl/annual" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              年度ダッシュボード
            </Link>
            {canManageSalary ? (
              <Link href="/settings/salary-records" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                社員コスト設定
              </Link>
            ) : null}
            {canManageFixedCosts ? (
              <>
                <Link href="/settings/rates" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                  単価
                </Link>
                <Link href="/settings/skill-careers" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                  評価制度設定
                </Link>
                <Link href="/settings/fixed-costs" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                  全社固定費設定
                </Link>
                <Link href="/operations/preflight" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                  本番前チェック
                </Link>
              </>
            ) : null}
            {canEditTeam && !showPersonalProfit ? (
              <span className="rounded-full bg-brand-300 px-4 py-2 text-sm font-semibold text-slate-950">PL入力可能</span>
            ) : null}
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article key={card.label} className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {card.value}
                <span className="ml-2 text-sm font-medium text-slate-500">{card.unit}</span>
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{showPersonalProfit ? "個人粗利サマリー" : "チーム別粗利差異"}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {showPersonalProfit ? "未所属社員は1人分の固定費按分を加味した個人粗利を表示します。" : canViewAll ? "全社表示" : "自チームのみ表示"}
                </p>
              </div>
              {!showPersonalProfit ? (
                <Link href={`/api/pl/dashboard?yearMonth=${yearMonth}`} className="text-sm font-medium text-brand-600">
                  API確認
                </Link>
              ) : null}
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{showPersonalProfit ? "対象" : "チーム"}</th>
                    <th className="px-4 py-3 font-medium">売上</th>
                    {showPersonalProfit ? <th className="px-4 py-3 font-medium">固定費按分</th> : null}
                    <th className="px-4 py-3 font-medium">目標率</th>
                    <th className="px-4 py-3 font-medium">実績率</th>
                    <th className="px-4 py-3 font-medium">差異</th>
                  </tr>
                </thead>
                <tbody>
                  {showPersonalProfit ? (
                    personalSummary ? (
                      <tr className="border-t border-slate-200">
                        <td className="px-4 py-3 font-medium text-slate-950">{user.name}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(personalSummary.salesTotal)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(personalSummary.fixedCostAllocation)}</td>
                        <td className="px-4 py-3 text-slate-700">{personalSummary.targetGrossProfitRate}%</td>
                        <td className="px-4 py-3 text-slate-700">{personalSummary.actualGrossProfitRate}%</td>
                        <td className={`px-4 py-3 font-semibold ${personalSummary.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {personalSummary.varianceRate >= 0 ? "+" : ""}{personalSummary.varianceRate}pt
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">当月の個人粗利データはまだありません。</td>
                      </tr>
                    )
                  ) : snapshots.map((row) => (
                    <tr key={`${row.teamId}-${row.yearMonth}`} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-950">
                        <Link href={`/pl/monthly?teamId=${row.teamId}&yearMonth=${yearMonth}`} className="text-brand-700 underline-offset-4 hover:underline">
                          {row.teamName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(row.salesTotal)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.targetGrossProfitRate}%</td>
                      <td className="px-4 py-3 text-slate-700">{row.actualGrossProfitRate}%</td>
                      <td className={`px-4 py-3 font-semibold ${row.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {row.varianceRate >= 0 ? "+" : ""}
                        {row.varianceRate}pt
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">評価進捗</h2>
            <p className="mt-1 text-sm text-slate-500">対象期間: {progress.periodName}</p>
            <div className="mt-5 space-y-4">
              {progress.stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">{stat.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{stat.completed} / {stat.total}</p>
                    </div>
                    <Link href={stat.href} className="text-sm font-medium text-brand-600">
                      進む
                    </Link>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">未完了メンバー</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stat.pendingMembers.length > 0 ? (
                      stat.pendingMembers.map((member) => (
                        <Link key={`${stat.label}-${member.name}`} href={member.href} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 ring-1 ring-slate-200">
                          {member.name}
                        </Link>
                      ))
                    ) : (
                      <span className="text-sm text-slate-600">未完了なし</span>
                    )}
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
