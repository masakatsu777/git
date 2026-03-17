import Link from "next/link";

import { AnnualTrendChart } from "@/components/pl/annual-trend-chart";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getCareerDetailBundle } from "@/lib/skill-careers/career-detail-service";

export default async function CareerStatusDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.masterWrite) || hasPermission(user, PERMISSIONS.evaluationFinalize);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">等級詳細</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
          </section>
        </div>
      </main>
    );
  }

  const { userId } = await params;
  const bundle = await getCareerDetailBundle(userId);
  const trendPoints = bundle.history.slice().reverse().map((row) => ({
    label: row.periodName,
    primaryValue: row.finalScoreTotal,
  }));

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Grade Detail</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">{bundle.employeeName} の等級詳細</h1>
              <p className="mt-2 text-sm text-slate-300">所属: {bundle.teamName}</p>
            </div>
            <div className="flex gap-3">
              <Link href="/settings/career-statuses" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                一覧へ戻る
              </Link>
              <Link href="/evaluations/finalize" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                最終評価へ
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-[1.75rem] bg-amber-50 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">現在総合等級</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{bundle.latestOverallGradeName}</p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">現在自律成長等級</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{bundle.latestItSkillGradeName}</p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">現在協調相乗等級</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{bundle.latestBusinessSkillGradeName}</p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">期待充足ランク</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{bundle.latestFinalRating}</p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">参考評価点</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{bundle.latestFinalScoreTotal}</p>
          </article>
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">協調相乗の根拠件数</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{bundle.history[0]?.synergyEvidenceCount ?? 0}</p>
            <p className="mt-2 text-xs text-slate-500">最新期に記録された継続実践の根拠件数です。</p>
          </article>
        </section>

        <section className="mt-8">
          <AnnualTrendChart
            title="参考評価点推移"
            subtitle="半期ごとの参考評価点の推移です。総合等級の補助指標として参照します。"
            primaryLabel="参考評価点"
            points={trendPoints}
            primaryColor="#0f766e"
          />
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold text-slate-950">評価・等級履歴</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">評価期間</th>
                  <th className="px-4 py-3 font-medium">期待充足ランク</th>
                  <th className="px-4 py-3 font-medium">参考評価点</th>
                  <th className="px-4 py-3 font-medium">総合等級</th>
                  <th className="px-4 py-3 font-medium">自律成長等級</th>
                  <th className="px-4 py-3 font-medium">協調相乗等級</th>
                  <th className="px-4 py-3 font-medium">根拠件数</th>
                </tr>
              </thead>
              <tbody>
                {bundle.history.map((row) => (
                  <tr key={row.evaluationPeriodId} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-950">{row.periodName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.finalRating}</td>
                    <td className="px-4 py-3 text-slate-700">{row.finalScoreTotal}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{row.overallGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.itSkillGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.businessSkillGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.synergyEvidenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">協調相乗力の根拠</h2>
              <p className="mt-1 text-sm text-slate-500">半期ごとに、継続実践として記録された根拠を確認できます。</p>
            </div>
          </div>
          <div className="mt-5 space-y-5">
            {bundle.history.map((row) => (
              <article key={row.evaluationPeriodId} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{row.periodName}</h3>
                    <p className="mt-1 text-sm text-slate-500">総合等級: {row.overallGradeName} / 協調相乗等級: {row.businessSkillGradeName} / 根拠件数: {row.synergyEvidenceCount}</p>
                  </div>
                </div>

                {row.synergyEvidenceItems.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">この期間の根拠登録はありません。</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {row.synergyEvidenceItems.map((item) => (
                      <section key={row.evaluationPeriodId + item.itemTitle} className="rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.majorCategory}</p>
                            <h4 className="mt-1 text-sm font-semibold text-slate-950">{item.itemTitle}</h4>
                          </div>
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">重み {item.weight}</span>
                        </div>
                        <div className="mt-3 space-y-3">
                          {item.evidences.map((evidence, index) => (
                            <div key={item.itemTitle + index} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              <p className="font-medium text-slate-900">{evidence.summary}</p>
                              {evidence.targetName ? <p className="mt-1 text-xs text-slate-500">対象: {evidence.targetName}</p> : null}
                              {evidence.periodNote ? <p className="mt-2 text-xs leading-5 text-slate-500">{evidence.periodNote}</p> : null}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
