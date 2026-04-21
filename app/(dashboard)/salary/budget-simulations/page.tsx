import Link from "next/link";

import { BudgetSimulationEditor } from "@/components/budget-simulation-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getBudgetSimulationBundle } from "@/lib/budget-simulations/budget-simulation-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getVisibleYearMonthOptions } from "@/lib/pl/service";

export default async function BudgetSimulationPage({
  searchParams,
}: {
  searchParams: Promise<{
    yearMonth?: string;
    departmentId?: string;
    teamId?: string;
    subjectType?: "ALL" | "EMPLOYEE" | "PARTNER";
    membershipFilter?: "ALL" | "ASSIGNED" | "UNASSIGNED";
  }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const canView = hasPermission(user, PERMISSIONS.salaryRead);
  const canEdit = hasPermission(user, PERMISSIONS.salaryWrite);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">予算制約シミュレーション</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
            <div className="mt-6">
              <Link href="/dashboard" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                ダッシュボードへ戻る
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const yearMonthOptions = await getVisibleYearMonthOptions();
  const selectedYearMonth = params.yearMonth ?? yearMonthOptions[0]?.yearMonth ?? "2026-03";
  const bundle = await getBudgetSimulationBundle({
    yearMonth: selectedYearMonth,
    departmentId: params.departmentId,
    teamId: params.teamId,
    subjectType: params.subjectType,
    membershipFilter: params.membershipFilter,
  });
  const filteredTeamOptions = bundle.filters.departmentId
    ? bundle.teamOptions.filter((team) => team.departmentId === bundle.filters.departmentId)
    : bundle.teamOptions;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbf8_0%,#edf6ef_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-emerald-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(6,78,59,0.24)]">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">Budget Simulation</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">予算制約シミュレーション</h1>
              <p className="mt-2 text-sm text-emerald-100">総額予算を守りながら、仮単価と昇給後人件費を置いたときの粗利見込を確認します。</p>
              <form method="get" className="mt-4 grid gap-4 rounded-[1.5rem] bg-white/10 p-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
                <label className="text-sm text-emerald-50">
                  対象月
                  <select
                    name="yearMonth"
                    defaultValue={bundle.yearMonth}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                  >
                    {yearMonthOptions.map((option) => (
                      <option key={option.yearMonth} value={option.yearMonth}>
                        {option.yearMonth}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-emerald-50">
                  部署
                  <select name="departmentId" defaultValue={bundle.filters.departmentId} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                    {bundle.departmentOptions.map((option) => (
                      <option key={option.id || "all"} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-emerald-50">
                  チーム
                  <select name="teamId" defaultValue={bundle.filters.teamId} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                    <option value="">すべて</option>
                    {filteredTeamOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-emerald-50">
                  区分
                  <select name="subjectType" defaultValue={bundle.filters.subjectType} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                    <option value="ALL">すべて</option>
                    <option value="EMPLOYEE">社員</option>
                    <option value="PARTNER">パートナー</option>
                  </select>
                </label>
                <label className="text-sm text-emerald-50">
                  所属状態
                  <select name="membershipFilter" defaultValue={bundle.filters.membershipFilter} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                    <option value="ALL">すべて</option>
                    <option value="ASSIGNED">所属あり</option>
                    <option value="UNASSIGNED">未所属</option>
                  </select>
                </label>
                <button type="submit" className="xl:col-span-5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-950">
                  表示切替
                </button>
              </form>
            </div>
            <div className="flex gap-3">
              <Link href="/salary/simulations" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                昇給決定
              </Link>
              <Link href={`/pl/monthly?yearMonth=${bundle.yearMonth}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                月次PL
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <BudgetSimulationEditor key={bundle.yearMonth} canEdit={canEdit} defaults={bundle} />
        </div>
      </div>
    </main>
  );
}
