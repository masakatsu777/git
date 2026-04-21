import Link from "next/link";

import { getSessionUser } from "@/lib/auth/demo-session";
import {
  getEvaluationGapGuidanceByQuadrant,
  isEvaluationGapQuadrant,
  type EvaluationGapQuadrant,
} from "@/lib/evaluations/evaluation-gap-guidance";
import { isUserMenuEnabled } from "@/lib/menu-visibility/menu-visibility-service";

const quadrantOrder: EvaluationGapQuadrant[] = [
  "high-eval-high-gross-profit",
  "high-eval-low-gross-profit",
  "high-eval-low-gross-profit-team-propagation",
  "low-eval-high-gross-profit",
  "low-eval-low-gross-profit",
];

export default async function EvaluationGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ quadrant?: string }>;
}) {
  const user = await getSessionUser();
  const philosophyPracticeEnabled = await isUserMenuEnabled(user.id, "philosophyPractice", user.role);

  if (!philosophyPracticeEnabled) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">理念実践ナビの対象外です</h1>
          <p className="mt-3 text-sm text-slate-600">この機能は現在のメニュー設定では利用対象外です。必要に応じて管理者へご相談ください。</p>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const requestedQuadrant = params.quadrant ?? "";
  const selectedQuadrant = isEvaluationGapQuadrant(requestedQuadrant)
    ? requestedQuadrant
    : "high-eval-low-gross-profit";
  const activeGuidance = getEvaluationGapGuidanceByQuadrant(selectedQuadrant);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Evaluation Guides</p>
          <h1 className="mt-3 text-3xl font-semibold">4象限ガイド</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            自己評価と粗利結果の組み合わせから、今の状態に合った見直しポイントと次アクションを確認できます。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/evaluations/result" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              マイ評価結果へ戻る
            </Link>
            <Link href="/evaluations/my" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              自己評価へ
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr,1.4fr]">
          <aside className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-slate-950">象限を選ぶ</h2>
            <div className="mt-4 flex flex-col gap-3">
              {quadrantOrder.map((quadrant) => {
                const guidance = getEvaluationGapGuidanceByQuadrant(quadrant);
                const active = quadrant === activeGuidance.quadrant;
                return (
                  <Link
                    key={quadrant}
                    href={`/evaluations/guides?quadrant=${quadrant}`}
                    className={`rounded-2xl border px-4 py-4 text-sm transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <p className={`font-semibold ${active ? "text-white" : "text-slate-950"}`}>{guidance.title}</p>
                    <p className={`mt-2 leading-6 ${active ? "text-slate-200" : "text-slate-500"}`}>{guidance.badgeLabel}</p>
                  </Link>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.18em] ${activeGuidance.badgeTone}`}>
                {activeGuidance.badgeLabel}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-600">
                {activeGuidance.guideTitle}
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-slate-950">{activeGuidance.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{activeGuidance.guidePurpose}</p>

            <article className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">押さえたいポイント</p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                {activeGuidance.guideKeyPoints.map((point) => (
                  <li key={point} className="rounded-xl bg-white px-3 py-3">{point}</li>
                ))}
              </ul>
            </article>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {activeGuidance.guideSections.map((section) => (
                <article key={section.title} className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-lg font-semibold text-slate-950">{section.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                    {section.points.map((point) => (
                      <li key={point} className="rounded-xl bg-slate-50 px-3 py-3">{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <article className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">次アクション</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{activeGuidance.nextAction}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/evaluations/result" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                  結果画面へ戻る
                </Link>
                <Link href="/evaluations/my" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  自己評価を見直す
                </Link>
              </div>
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}
