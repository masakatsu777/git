import Link from "next/link";
import { notFound } from "next/navigation";

import { getAnnualGoalDetailBundle, formatAnnualGoalJudgement } from "@/lib/annual-goals/service";
import { getSessionUser } from "@/lib/auth/demo-session";

type AnnualGoalDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

function formatGoalType(value: "team" | "personal") {
  return value === "team" ? "チーム" : "個人";
}

function formatDiff(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}pt`;
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function AnnualGoalDetailPage({ params }: AnnualGoalDetailPageProps) {
  const { id } = await params;
  const user = await getSessionUser();
  const bundle = await getAnnualGoalDetailBundle(user, id);

  if (!bundle) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Annual Goal</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">年度目標詳細</h1>
              <p className="mt-2 text-sm text-slate-300">{bundle.fiscalYear}年度 / {formatGoalType(bundle.goalType)} / {bundle.targetName}</p>
            </div>
            <div className="flex gap-3">
              <Link href="/annual-goals" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                一覧へ戻る
              </Link>
              {bundle.meta.canEdit ? (
                <Link href={`/annual-goals/${bundle.id}/edit`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                  編集する
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">基本情報</h2>
            <dl className="mt-5 grid gap-4 md:grid-cols-2">
              <div><dt className="text-sm text-slate-500">年度</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{bundle.fiscalYear}年度</dd></div>
              <div><dt className="text-sm text-slate-500">区分</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{formatGoalType(bundle.goalType)}</dd></div>
              <div><dt className="text-sm text-slate-500">対象</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{bundle.targetName}</dd></div>
              <div><dt className="text-sm text-slate-500">対象評価期間</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{bundle.evaluationPeriodName}</dd></div>
              <div><dt className="text-sm text-slate-500">作成者</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{bundle.meta.createdByName}</dd></div>
              <div><dt className="text-sm text-slate-500">更新日時</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{formatDateTime(bundle.meta.updatedAt)}</dd></div>
            </dl>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">総合判定</h2>
            <p className="mt-4 text-3xl font-semibold text-slate-950">{formatAnnualGoalJudgement(bundle.analysis.overallJudgement)}</p>
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">{bundle.analysis.insightComment}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {bundle.analysis.priorityThemeCandidates.map((item) => (
                <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{item}</span>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">粗利分析</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">粗利目標率</p><p className="mt-2 text-2xl font-semibold text-slate-950">{bundle.analysis.grossProfitTargetRate.toFixed(1)}%</p></article>
              <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">粗利実績率</p><p className="mt-2 text-2xl font-semibold text-slate-950">{bundle.analysis.grossProfitActualRate.toFixed(1)}%</p></article>
              <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">粗利差異</p><p className={`mt-2 text-2xl font-semibold ${bundle.analysis.grossProfitDiff < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatDiff(bundle.analysis.grossProfitDiff)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">粗利判定</p><p className={`mt-2 text-2xl font-semibold ${bundle.analysis.grossProfitStatus === "under" ? "text-rose-700" : "text-emerald-700"}`}>{bundle.analysis.grossProfitStatus === "under" ? "未達" : "達成"}</p></article>
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-semibold text-slate-950">評価分析</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">自律的成長平均</p><p className="mt-2 text-2xl font-semibold text-slate-950">{bundle.analysis.selfGrowthAverage.toFixed(1)}</p><p className={`mt-1 text-sm ${bundle.analysis.selfGrowthDelta < 0 ? "text-rose-700" : "text-emerald-700"}`}>前回比 {formatDiff(bundle.analysis.selfGrowthDelta)}</p></article>
              <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">協調相乗平均</p><p className="mt-2 text-2xl font-semibold text-slate-950">{bundle.analysis.synergyAverage.toFixed(1)}</p><p className={`mt-1 text-sm ${bundle.analysis.synergyDelta < 0 ? "text-rose-700" : "text-emerald-700"}`}>前回比 {formatDiff(bundle.analysis.synergyDelta)}</p></article>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {bundle.analysis.weakItems.map((item) => (
                <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{item}</span>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold text-slate-950">目標内容</h2>
          <div className="mt-5 grid gap-5">
            <section><h3 className="text-sm font-semibold text-slate-500">優先テーマ</h3><p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">{bundle.content.priorityTheme || "-"}</p></section>
            <section><h3 className="text-sm font-semibold text-slate-500">現状認識</h3><p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">{bundle.content.currentAnalysis || "-"}</p></section>
            <section><h3 className="text-sm font-semibold text-slate-500">年度目標</h3><p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">{bundle.content.annualGoal || "-"}</p></section>
            <section><h3 className="text-sm font-semibold text-slate-500">粗利改善施策</h3><p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">{bundle.content.grossProfitActions || "-"}</p></section>
            <section><h3 className="text-sm font-semibold text-slate-500">育成施策</h3><p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">{bundle.content.developmentActions || "-"}</p></section>
            <section><h3 className="text-sm font-semibold text-slate-500">達成指標</h3><p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">{bundle.content.kpi || "-"}</p></section>
            <section><h3 className="text-sm font-semibold text-slate-500">半期見直しメモ</h3><p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">{bundle.content.midtermMemo || "-"}</p></section>
          </div>
        </section>
      </div>
    </main>
  );
}
