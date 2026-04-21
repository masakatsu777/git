import Link from "next/link";

import { formatAnnualGoalJudgement, type AnnualGoalListBundle } from "@/lib/annual-goals/service";

function formatGoalType(value: "team" | "personal") {
  return value === "team" ? "チーム" : "個人";
}

function formatStatus(value: "achieved" | "under") {
  return value === "under" ? "未達" : "達成";
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

export function AnnualGoalList({ bundle }: { bundle: AnnualGoalListBundle }) {
  if (bundle.rows.length === 0) {
    return (
      <article className="rounded-[1.75rem] bg-white p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <h2 className="text-2xl font-semibold text-slate-950">該当する年度目標はありません</h2>
        <p className="mt-3 text-sm text-slate-600">条件を変えて再度絞り込むか、新規作成から登録してください。</p>
      </article>
    );
  }

  return (
    <div className="space-y-4">
      {bundle.rows.map((row) => (
        <article key={row.id} className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{row.fiscalYear}年度</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatGoalType(row.goalType)}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.grossProfitStatus === "under" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{formatStatus(row.grossProfitStatus)}</span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">{row.targetName}</h2>
              <p className="mt-2 text-sm text-slate-600">
                評価期間: {row.evaluationPeriodName}
                {row.priorityTheme ? ` / 優先テーマ: ${row.priorityTheme}` : " / 年度目標未作成"}
              </p>
              {bundle.permissions.canViewAnalysisSummary ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">粗利分析</p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      目標 {row.analysisSummary.grossProfitTargetRate}% / 実績 {row.analysisSummary.grossProfitActualRate}%
                    </p>
                    <p className={`mt-1 text-lg font-semibold ${row.analysisSummary.grossProfitDiff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {row.analysisSummary.grossProfitDiff >= 0 ? "+" : ""}{row.analysisSummary.grossProfitDiff} pt
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">評価分析</p>
                    <p className="mt-2 text-sm font-medium text-slate-700">自律的成長 {row.analysisSummary.selfGrowthAverage}</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">協調相乗 {row.analysisSummary.synergyAverage}</p>
                    {row.analysisSummary.weakItems.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-500">弱点項目: {row.analysisSummary.weakItems.join(" / ")}</p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">総合判定</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {formatAnnualGoalJudgement(row.analysisSummary.overallJudgement)}
                    </p>
                  </div>
                </div>
              ) : null}
              <p className="mt-1 text-sm text-slate-500">更新日: {row.updatedAt ? formatDateTime(row.updatedAt) : "未作成"}</p>
            </div>
            <div className="flex gap-3">
              {row.goalId ? (
                <Link href={`/annual-goals/${row.goalId}`} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                  詳細を見る
                </Link>
              ) : (
                <span className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-400">
                  分析のみ
                </span>
              )}
              {row.canEdit && row.goalId ? (
                <Link href={`/annual-goals/${row.id}/edit`} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                  編集する
                </Link>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
