import Link from "next/link";

import { MonthlyPlDetailEditor } from "@/components/pl/monthly-pl-detail-editor";
import { MonthlyPlEditor } from "@/components/pl/monthly-pl-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { canAccessTeam, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getTeamMonthlyDetails } from "@/lib/pl/detail-service";
import { getTeamMonthlySnapshot, getVisibleTeamOptions, getVisibleYearMonthOptions } from "@/lib/pl/service";

const detailRows = [
  ["売上合計", "salesTotal"],
  ["人件費", "directLaborCost"],
  ["外注費", "outsourcingCost"],
  ["1次粗利", "grossProfit1"],
  ["チーム経費", "indirectCost"],
  ["2次粗利", "grossProfit2"],
  ["全社固定費按分", "fixedCostAllocation"],
  ["最終粗利", "finalGrossProfit"],
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

export default async function MonthlyPlPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string; yearMonth?: string }> ;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const defaultTeamId = user.teamIds[0] ?? "team-platform";
  const requestedTeamId = params.teamId ?? defaultTeamId;
  const yearMonth = params.yearMonth ?? "2026-03";
  const teamId = canAccessTeam(user, requestedTeamId) ? requestedTeamId : defaultTeamId;
  const [snapshot, details, teamOptions, yearMonthOptions] = await Promise.all([
    getTeamMonthlySnapshot(teamId, yearMonth),
    getTeamMonthlyDetails(teamId, yearMonth),
    getVisibleTeamOptions(user.role === "admin" || user.role === "president" ? undefined : user.teamIds),
    getVisibleYearMonthOptions(teamId),
  ]);
  const canEdit = hasPermission(user, PERMISSIONS.plTeamWrite);
  const canManageFixedCosts = hasPermission(user, PERMISSIONS.masterWrite);
  const canManageSalary = hasPermission(user, PERMISSIONS.salaryRead);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf7_0%,#f7f2e8_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-stone-950 px-8 py-7 text-stone-50 shadow-[0_30px_80px_rgba(41,37,36,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-amber-200">Team Profitability</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">月次PL詳細</h1>
              <p className="mt-2 text-sm text-stone-300">
                {snapshot.teamName} / {snapshot.yearMonth} / summary: {snapshot.source} / details: {details.source}
              </p>
              <p className="mt-2 text-sm text-stone-400">
                人件費は社員コストと所属情報から自動集計、全社固定費は社員人数比で按分しています。
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {teamOptions.map((option) => {
                    const active = option.teamId === snapshot.teamId;
                    return (
                      <Link
                        key={option.teamId}
                        href={`/pl/monthly?teamId=${option.teamId}&yearMonth=${snapshot.yearMonth}`}
                        className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-amber-300 text-stone-950" : "border border-white/15 text-white"}`}
                      >
                        {option.teamName}
                      </Link>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {yearMonthOptions.map((option) => {
                    const active = option.yearMonth === snapshot.yearMonth;
                    return (
                      <Link
                        key={option.yearMonth}
                        href={`/pl/monthly?teamId=${snapshot.teamId}&yearMonth=${option.yearMonth}`}
                        className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-white text-stone-950" : "border border-white/15 text-white"}`}
                      >
                        {option.yearMonth}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                ダッシュボードへ
              </Link>
              {canManageSalary ? (
                <Link href="/settings/salary-records" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                  社員コスト設定
                </Link>
              ) : null}
              {canManageFixedCosts ? (
                <>
                  <Link href="/settings/rates" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                    売上
                  </Link>
                  <Link href="/settings/fixed-costs" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                    全社固定費設定
                  </Link>
                </>
              ) : null}
              {canEdit ? (
                <span className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-stone-950">編集可能</span>
              ) : (
                <span className="rounded-full bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-700">閲覧専用</span>
              )}
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="space-y-6">
            <MonthlyPlDetailEditor
              teamId={details.teamId}
              yearMonth={details.yearMonth}
              canEdit={canEdit}
              employeeOptions={details.employeeOptions}
              partnerOptions={details.partnerOptions}
              fixedCostSummary={details.fixedCostSummary}
              defaults={{
                assignments: details.assignments.map((row) => ({
                  id: row.id,
                  targetType: row.targetType,
                  userId: row.userId,
                  partnerId: row.partnerId,
                  unitPrice: row.unitPrice,
                  salesAmount: row.salesAmount,
                  workRate: row.workRate,
                  remarks: row.remarks,
                })),
                outsourcingCosts: details.outsourcingCosts.map((row) => ({
                  id: row.id,
                  partnerId: row.partnerId,
                  amount: row.amount,
                  remarks: row.remarks,
                })),
                teamExpenses: details.teamExpenses,
                salesTarget: details.salesTarget,
                grossProfitTarget: details.grossProfitTarget,
                grossProfitRateTarget: details.grossProfitRateTarget,
              }}
            />

            <MonthlyPlEditor
              teamId={snapshot.teamId}
              yearMonth={snapshot.yearMonth}
              canEdit={canEdit}
              defaults={{
                salesTotal: snapshot.salesTotal,
                directLaborCost: snapshot.directLaborCost,
                outsourcingCost: snapshot.outsourcingCost,
                indirectCost: snapshot.indirectCost,
                fixedCostAllocation: snapshot.fixedCostAllocation,
                targetGrossProfitRate: snapshot.targetGrossProfitRate,
              }}
            />
          </article>

          <article className="space-y-6">
            <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
              <h2 className="text-xl font-semibold">粗利計算内訳</h2>
              <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
                <table className="min-w-full text-left text-sm">
                  <tbody>
                    {detailRows.map(([label, key]) => (
                      <tr key={key} className="border-t border-stone-200 first:border-t-0">
                        <th className="w-1/2 bg-stone-50 px-4 py-4 font-medium text-stone-600">{label}</th>
                        <td className="px-4 py-4 font-semibold text-stone-950">{formatCurrency(snapshot[key])} 円</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
              <h2 className="text-xl font-semibold">目標差異</h2>
              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="text-sm text-stone-500">目標粗利率</p>
                  <p className="mt-2 text-2xl font-semibold">{snapshot.targetGrossProfitRate}%</p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="text-sm text-stone-500">実績粗利率</p>
                  <p className="mt-2 text-2xl font-semibold">{snapshot.actualGrossProfitRate}%</p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="text-sm text-stone-500">差異</p>
                  <p className={`mt-2 text-2xl font-semibold ${snapshot.varianceRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {snapshot.varianceRate >= 0 ? "+" : ""}{snapshot.varianceRate} pt
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
              <h2 className="text-xl font-semibold">APIエンドポイント</h2>
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <p>`GET /api/salary-records?yearMonth=2026-03`</p>
                <p>`POST /api/salary-records`</p>
                <p>`GET /api/pl/fixed-costs?yearMonth={snapshot.yearMonth}`</p>
                <p>`POST /api/pl/fixed-costs`</p>
                <p>`GET /api/pl/details?teamId={snapshot.teamId}&yearMonth={snapshot.yearMonth}`</p>
                <p>`POST /api/pl/details`</p>
                <p>`GET /api/pl/monthly?teamId={snapshot.teamId}&yearMonth={snapshot.yearMonth}`</p>
                <p>`POST /api/pl/recalculate/{snapshot.teamId}?yearMonth={snapshot.yearMonth}`</p>
              </div>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}



