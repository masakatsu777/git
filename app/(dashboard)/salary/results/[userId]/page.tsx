import Link from "next/link";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getCareerDetailBundle } from "@/lib/skill-careers/career-detail-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSalaryResultDetailBundle } from "@/lib/salary-simulations/salary-simulation-service";

export default async function SalaryResultDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ evaluationPeriodId?: string }>;
}) {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.salaryRead);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">昇給結果詳細</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
          </section>
        </div>
      </main>
    );
  }

  const { userId } = await params;
  const query = await searchParams;
  const [salaryResult, careerDetail] = await Promise.all([
    getSalaryResultDetailBundle(userId, query.evaluationPeriodId),
    getCareerDetailBundle(userId),
  ]);
  const row = salaryResult.row;
  const diffAmount = row.newSalary - row.finalSalaryReference;
  const diffRate = row.finalSalaryReference === 0 ? 0 : Math.round((diffAmount / row.finalSalaryReference) * 10000) / 100;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Salary Result Detail</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">{row.employeeName} の昇給結果詳細</h1>
              <p className="mt-2 text-sm text-slate-300">{salaryResult.periodName} / {row.teamName}</p>
            </div>
            <div className="flex gap-3">
              <Link href={`/salary/results?evaluationPeriodId=${row.evaluationPeriodId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                一覧へ戻る
              </Link>
              <Link href={`/settings/career-statuses/${row.userId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                等級詳細
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">総合等級</p><p className="mt-3 text-2xl font-semibold text-slate-950">{row.overallGradeName}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">自律成長等級</p><p className="mt-3 text-2xl font-semibold text-slate-950">{careerDetail.latestItSkillGradeName}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">協調相乗等級</p><p className="mt-3 text-2xl font-semibold text-slate-950">{careerDetail.latestBusinessSkillGradeName}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">期待充足ランク</p><p className="mt-3 text-2xl font-semibold text-slate-950">{row.finalRating}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">参考評価点</p><p className="mt-3 text-2xl font-semibold text-slate-950">{row.finalScoreTotal}</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">状態</p><p className="mt-3 text-2xl font-semibold text-slate-950">{row.status}</p></article>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">新月額(参考)</p><p className="mt-3 text-2xl font-semibold text-slate-950">{row.finalSalaryReference.toLocaleString("ja-JP")} 円</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">決定額</p><p className="mt-3 text-2xl font-semibold text-slate-950">{row.newSalary.toLocaleString("ja-JP")} 円</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">差額 / 差率</p><p className={`mt-3 text-2xl font-semibold ${diffAmount === 0 ? "text-slate-950" : diffAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>{(diffAmount > 0 ? "+" : "") + diffAmount.toLocaleString("ja-JP")} 円</p><p className="mt-1 text-sm text-slate-500">{(diffRate > 0 ? "+" : "") + diffRate}%</p></article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><p className="text-sm text-slate-500">昇給額</p><p className="mt-3 text-2xl font-semibold text-slate-950">{row.proposedRaiseAmount.toLocaleString("ja-JP")} 円</p><p className="mt-1 text-sm text-slate-500">昇給率 {row.proposedRaiseRate}%</p></article>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold text-slate-950">調整理由</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{row.adjustmentReason || "調整理由は登録されていません。"}</p>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold text-slate-950">協調相乗力の根拠</h2>
          <div className="mt-4 space-y-4">
            {(careerDetail.history[0]?.synergyEvidenceItems ?? []).map((item) => (
              <article key={item.itemTitle} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.majorCategory}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.itemTitle}</h3>
                <div className="mt-3 space-y-2">
                  {item.evidences.map((evidence, index) => (
                    <div key={item.itemTitle + String(index)} className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">{evidence.summary}</p>
                      {evidence.targetName ? <p className="mt-1 text-xs text-slate-500">対象: {evidence.targetName}</p> : null}
                      {evidence.periodNote ? <p className="mt-2 text-xs text-slate-500">{evidence.periodNote}</p> : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {(careerDetail.history[0]?.synergyEvidenceItems ?? []).length === 0 ? <p className="text-sm text-slate-500">根拠登録はありません。</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
