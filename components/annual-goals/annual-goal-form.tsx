"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AnnualGoalEditorBundle } from "@/lib/annual-goals/service";

type AnnualGoalFormProps = {
  initialBundle: AnnualGoalEditorBundle;
  mode: "create" | "edit";
  goalId?: string;
};

function formatPercent(value: number) {
  return `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(1)}%`;
}

function formatDiff(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}pt`;
}

function formatGoalType(value: "team" | "personal") {
  return value === "team" ? "チーム" : "個人";
}

function formatJudgement(value: AnnualGoalEditorBundle["analysis"]["overallJudgement"]) {
  switch (value) {
    case "gross-profit-first":
      return "粗利優先";
    case "growth-first":
      return "成長課題優先";
    case "maintain-and-improve":
    default:
      return "維持向上";
  }
}

export function AnnualGoalForm({ initialBundle, mode, goalId }: AnnualGoalFormProps) {
  const router = useRouter();
  const [bundle, setBundle] = useState(initialBundle);
  const [fiscalYear, setFiscalYear] = useState(String(initialBundle.fiscalYear));
  const [evaluationPeriodId, setEvaluationPeriodId] = useState(initialBundle.evaluationPeriodId);
  const [priorityTheme, setPriorityTheme] = useState(initialBundle.draft.priorityTheme);
  const [currentAnalysis, setCurrentAnalysis] = useState(initialBundle.draft.currentAnalysis);
  const [annualGoal, setAnnualGoal] = useState(initialBundle.draft.annualGoal);
  const [grossProfitActions, setGrossProfitActions] = useState(initialBundle.draft.grossProfitActions);
  const [developmentActions, setDevelopmentActions] = useState(initialBundle.draft.developmentActions);
  const [kpi, setKpi] = useState(initialBundle.draft.kpi);
  const [midtermMemo, setMidtermMemo] = useState(initialBundle.draft.midtermMemo);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reloadAnalysis(nextEvaluationPeriodId: string) {
    const params = new URLSearchParams();
    params.set("fiscalYear", fiscalYear);
    params.set("evaluationPeriodId", nextEvaluationPeriodId);

    const response = await fetch(`/api/annual-goals/editor?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as AnnualGoalEditorBundle & { message?: string };

    if (!response.ok) {
      setMessage(payload.message ?? "年度目標の分析読み込みに失敗しました。");
      return;
    }

    setBundle(payload);
    setEvaluationPeriodId(payload.evaluationPeriodId);
    if (!priorityTheme.trim()) {
      setPriorityTheme(payload.draft.priorityTheme);
    }
  }

  async function handleSave() {
    setMessage(null);

    if (!priorityTheme.trim()) {
      setMessage("優先テーマを入力してください。");
      return;
    }
    if (!annualGoal.trim()) {
      setMessage("年度目標を入力してください。");
      return;
    }

    startTransition(async () => {
      const targetId = goalId ?? bundle.draft.id;
      const url = targetId ? `/api/annual-goals/${targetId}` : "/api/annual-goals";
      const method = targetId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetId ?? undefined,
          fiscalYear: Number(fiscalYear),
          evaluationPeriodId,
          priorityTheme,
          currentAnalysis,
          annualGoal,
          grossProfitActions,
          developmentActions,
          kpi,
          midtermMemo,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
      setMessage(payload?.message ?? (response.ok ? "年度目標を保存しました。" : "年度目標の保存に失敗しました。"));

      if (!response.ok || !payload?.id) {
        return;
      }

      router.push(`/annual-goals/${payload.id}`);
      router.refresh();
    });
  }

  return (
    <section className="space-y-6">
      <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Annual Goal</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{mode === "edit" ? "年度目標編集" : "年度目標作成"}</h2>
            <p className="mt-2 text-sm text-slate-600">まず粗利達成状況を確認し、そのうえで評価結果から改善の方向性を整理して年度目標を設定します。</p>
          </div>
          <div className="flex gap-3">
            <Link href="/annual-goals" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
              一覧へ
            </Link>
            <Link href="/monthly-report" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
              月報メニューへ
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !bundle.permissions.canEdit}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "保存中..." : mode === "edit" ? "更新する" : "保存する"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-700">
            年度
            <input
              type="number"
              value={fiscalYear}
              onChange={(event) => setFiscalYear(event.target.value)}
              disabled={!bundle.permissions.canEdit || isPending}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
            />
          </label>
          <label className="text-sm text-slate-700">
            区分
            <input
              value={formatGoalType(bundle.goalType)}
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none"
            />
          </label>
          <label className="text-sm text-slate-700">
            対象
            <input
              value={bundle.targetName}
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none"
            />
          </label>
          <label className="text-sm text-slate-700">
            対象評価期間
            <select
              value={evaluationPeriodId}
              onChange={(event) => {
                const next = event.target.value;
                setEvaluationPeriodId(next);
                startTransition(async () => {
                  await reloadAnalysis(next);
                });
              }}
              disabled={isPending}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
            >
              {bundle.evaluationPeriodOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {bundle.notice}
          <div className="mt-2 text-slate-500">
            粗利が未達の場合は、まず粗利達成を最優先に考えます。評価分析は、そのために何を改善すべきかを整理するための参考情報です。
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </article>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h3 className="text-xl font-semibold text-slate-950">粗利分析</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">粗利目標率</p><p className="mt-2 text-2xl font-semibold text-slate-950">{formatPercent(bundle.analysis.grossProfitTargetRate)}</p></article>
            <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">粗利実績率</p><p className="mt-2 text-2xl font-semibold text-slate-950">{formatPercent(bundle.analysis.grossProfitActualRate)}</p></article>
            <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">粗利差異</p><p className={`mt-2 text-2xl font-semibold ${bundle.analysis.grossProfitDiff < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatDiff(bundle.analysis.grossProfitDiff)}</p></article>
            <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">粗利判定</p><p className={`mt-2 text-2xl font-semibold ${bundle.analysis.grossProfitStatus === "under" ? "text-rose-700" : "text-emerald-700"}`}>{bundle.analysis.grossProfitStatus === "under" ? "未達" : "達成"}</p></article>
          </div>
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">{bundle.analysis.insightComment}</p>
        </article>

        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h3 className="text-xl font-semibold text-slate-950">評価分析</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">自律的成長平均</p><p className="mt-2 text-2xl font-semibold text-slate-950">{bundle.analysis.selfGrowthAverage.toFixed(1)}</p><p className={`mt-1 text-sm ${bundle.analysis.selfGrowthDelta < 0 ? "text-rose-700" : "text-emerald-700"}`}>前回比 {formatDiff(bundle.analysis.selfGrowthDelta)}</p></article>
            <article className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">協調相乗平均</p><p className="mt-2 text-2xl font-semibold text-slate-950">{bundle.analysis.synergyAverage.toFixed(1)}</p><p className={`mt-1 text-sm ${bundle.analysis.synergyDelta < 0 ? "text-rose-700" : "text-emerald-700"}`}>前回比 {formatDiff(bundle.analysis.synergyDelta)}</p></article>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">参考弱点項目</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {bundle.analysis.weakItems.length > 0 ? bundle.analysis.weakItems.map((item) => (
                <span key={item} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm">{item}</span>
              )) : <span className="text-slate-500">弱点項目はありません。</span>}
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h3 className="text-xl font-semibold text-slate-950">総合判定</h3>
          <p className="mt-4 text-3xl font-semibold text-slate-950">{formatJudgement(bundle.analysis.overallJudgement)}</p>
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-950">推奨重点テーマ</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {bundle.analysis.priorityThemeCandidates.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPriorityTheme(item)}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition ${priorityTheme === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h3 className="text-xl font-semibold text-slate-950">年度目標入力</h3>
          <div className="mt-5 grid gap-4">
            <label className="text-sm text-slate-700">
              優先テーマ
              <input
                value={priorityTheme}
                onChange={(event) => setPriorityTheme(event.target.value)}
                disabled={!bundle.permissions.canEdit || isPending}
                placeholder="今年度でもっとも優先するテーマを記入してください"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm text-slate-700">
              現状認識
              <textarea
                value={currentAnalysis}
                onChange={(event) => setCurrentAnalysis(event.target.value)}
                disabled={!bundle.permissions.canEdit || isPending}
                placeholder="粗利状況と評価傾向を踏まえた現状を記入してください"
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm text-slate-700">
              年度目標
              <textarea
                value={annualGoal}
                onChange={(event) => setAnnualGoal(event.target.value)}
                disabled={!bundle.permissions.canEdit || isPending}
                placeholder="1年後に目指す状態を記入してください"
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm text-slate-700">
              粗利改善施策
              <textarea
                value={grossProfitActions}
                onChange={(event) => setGrossProfitActions(event.target.value)}
                disabled={!bundle.permissions.canEdit || isPending}
                placeholder="粗利達成に向けて実施する施策を記入してください"
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm text-slate-700">
              育成施策
              <textarea
                value={developmentActions}
                onChange={(event) => setDevelopmentActions(event.target.value)}
                disabled={!bundle.permissions.canEdit || isPending}
                placeholder="行動改善や育成のための施策を記入してください"
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm text-slate-700">
              達成指標
              <textarea
                value={kpi}
                onChange={(event) => setKpi(event.target.value)}
                disabled={!bundle.permissions.canEdit || isPending}
                placeholder="結果指標と行動指標を記入してください"
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm text-slate-700">
              半期見直しメモ
              <textarea
                value={midtermMemo}
                onChange={(event) => setMidtermMemo(event.target.value)}
                disabled={!bundle.permissions.canEdit || isPending}
                placeholder="上期終了時点での見直し内容を記入してください"
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-50"
              />
            </label>
          </div>
        </article>
      </section>
    </section>
  );
}
