import Link from "next/link";

import { SalarySimulationEditor } from "@/components/salary-simulation-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getEvaluationPeriodOptions } from "@/lib/evaluations/period-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSalarySimulationBundle } from "@/lib/salary-simulations/salary-simulation-service";

export default async function SalarySimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ evaluationPeriodId?: string }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const canView = hasPermission(user, PERMISSIONS.salaryRead);
  const canEdit = hasPermission(user, PERMISSIONS.salaryWrite);
  const canApprove = hasPermission(user, PERMISSIONS.salaryApprove);
  const canApply = hasPermission(user, PERMISSIONS.salaryWrite);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">昇給決定</h1>
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

  const periods = await getEvaluationPeriodOptions();
  const activeEvaluationPeriodId = params.evaluationPeriodId ?? periods[0]?.id;
  const bundle = await getSalarySimulationBundle(activeEvaluationPeriodId);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Salary Decision</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">昇給決定</h1>
              <p className="mt-2 text-sm text-slate-300">最終評価が確定した対象者について、自動算出昇給額・調整額・最終昇給額を管理し、管理者調整と役員承認を進めます。</p>
              <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm text-slate-200">
                  評価期間
                  <select
                    name="evaluationPeriodId"
                    defaultValue={bundle.evaluationPeriodId}
                    className="mt-2 min-w-72 rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                  >
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name}（{period.status}）
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                  表示切替
                </button>
              </form>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                ダッシュボードへ
              </Link>
              <Link href={`/evaluations/finalize?evaluationPeriodId=${bundle.evaluationPeriodId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                最終評価
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <SalarySimulationEditor canEdit={canEdit} canApprove={canApprove} canApply={canApply} defaults={bundle} />
        </div>
      </div>
    </main>
  );
}
