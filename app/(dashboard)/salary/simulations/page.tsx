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
            <h1 className="text-2xl font-semibold text-slate-950">昇給シミュレーション</h1>
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

  const bundle = await getSalarySimulationBundle(params.evaluationPeriodId);
  const periods = await getEvaluationPeriodOptions();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Salary Simulation</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">昇給シミュレーション</h1>
              <p className="mt-2 text-sm text-slate-300">総合等級を主基準とし、期待充足ランクは現在の役割期待に対する充足度を見る補助基準として昇給案を試算し、給与改定前の比較を行います。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {periods.map((period) => {
                  const active = period.id === bundle.evaluationPeriodId;
                  return (
                    <Link
                      key={period.id}
                      href={`/salary/simulations?evaluationPeriodId=${period.id}`}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "border border-brand-300 bg-brand-200 text-black shadow-sm font-semibold" : "border border-slate-200 bg-white/90 text-black"}`}
                    >
                      <span style={{ color: "#000000" }}>{period.name}</span>
                    </Link>
                  );
                })}
              </div>
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
