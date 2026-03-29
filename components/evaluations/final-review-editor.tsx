"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EvaluationResultSummary } from "@/components/evaluations/evaluation-result-summary";
import type { FinalReviewBundle, FinalReviewItem } from "@/lib/evaluations/final-review-service";

type FinalReviewEditorProps = {
  canEdit: boolean;
  defaults: FinalReviewBundle;
};

type AxisReviewState = {
  score: number;
  comment: string;
};

function calculateTotal(items: Array<{ score: number; weight: number }>) {
  return Math.round(items.reduce((sum, item) => sum + item.score * item.weight, 0) * 100) / 100;
}

function buildAxisState(items: FinalReviewItem[]) {
  return {
    score: items[0]?.finalScore ?? 0,
    comment: items[0]?.finalComment ?? "",
  } satisfies AxisReviewState;
}

function buildAxisPayload(items: FinalReviewItem[], state: AxisReviewState) {
  return items.map((item) => ({
    evaluationItemId: item.evaluationItemId,
    score: state.score,
    comment: state.comment,
    evidences: item.evidences,
  }));
}

function renderReferenceItems(items: FinalReviewItem[], showEvidence: boolean) {
  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <article key={item.evaluationItemId} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.majorCategory} / {item.minorCategory}</p>
          <h4 className="mt-2 text-sm font-semibold text-slate-950">{item.title}</h4>
          <p className="mt-2 text-sm text-slate-500">自己 {item.selfScore} / 上長 {item.managerScore} / 重み {item.weight}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">本人コメント</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.selfComment || "コメントはありません。"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">上長コメント</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.managerComment || "コメントはありません。"}</p>
            </div>
          </div>
          {showEvidence && item.evidences.length > 0 ? (
            <div className="mt-3 rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">本人入力の根拠</p>
              <div className="mt-2 space-y-2">
                {item.evidences.map((evidence, index) => (
                  <div key={`${item.evaluationItemId}-${index}`} className="rounded-xl bg-white px-3 py-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">{evidence.summary || "概要なし"}</p>
                    {evidence.targetName ? <p className="mt-1 text-xs text-slate-500">対象: {evidence.targetName}</p> : null}
                    {evidence.periodNote ? <p className="mt-2 text-xs text-slate-500">{evidence.periodNote}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function FinalReviewEditor({ canEdit, defaults }: FinalReviewEditorProps) {
  const router = useRouter();
  const [items] = useState(defaults.items);
  const [finalComment, setFinalComment] = useState(defaults.finalComment);
  const [selfGrowthReview, setSelfGrowthReview] = useState<AxisReviewState>(() => buildAxisState(defaults.items.filter((item) => item.axis === "SELF_GROWTH")));
  const [synergyReview, setSynergyReview] = useState<AxisReviewState>(() => buildAxisState(defaults.items.filter((item) => item.axis === "SYNERGY")));
  const [showSelfGrowthDetails, setShowSelfGrowthDetails] = useState(false);
  const [showSynergyDetails, setShowSynergyDetails] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  const selfGrowthItems = useMemo(() => items.filter((item) => item.axis === "SELF_GROWTH"), [items]);
  const synergyItems = useMemo(() => items.filter((item) => item.axis === "SYNERGY"), [items]);
  const payloadItems = useMemo(
    () => [
      ...buildAxisPayload(selfGrowthItems, selfGrowthReview),
      ...buildAxisPayload(synergyItems, synergyReview),
    ],
    [selfGrowthItems, selfGrowthReview, synergyItems, synergyReview],
  );
  const liveTotal = useMemo(
    () => calculateTotal([
      ...selfGrowthItems.map((item) => ({ score: selfGrowthReview.score, weight: item.weight })),
      ...synergyItems.map((item) => ({ score: synergyReview.score, weight: item.weight })),
    ]),
    [selfGrowthItems, selfGrowthReview.score, synergyItems, synergyReview.score],
  );

  async function handleSave() {
    setMessage(null);


    startSaving(async () => {
      const response = await fetch("/api/evaluations/final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationPeriodId: defaults.evaluationPeriodId,
          userId: defaults.selectedUserId,
          finalComment,
          items: payloadItems,
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "確定しました" : "保存に失敗しました"));

      if (response.ok) {
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">最終評価確定</h2>
          <p className="mt-1 text-sm text-slate-500">上長評価を踏まえ、自律成長力と協調相乗力を軸単位で最終確定します。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : <span className="rounded-full bg-amber-100 px-4 py-2 text-sm text-amber-700">最終確定可能</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象期間</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.periodName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象者</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.selectedUserName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">職種</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.positionName}</p>
          <p className="mt-1 text-sm text-slate-500">職種別の等級閾値がある場合はそのルールを優先します。</p>
        </div>
      </div>

      <EvaluationResultSummary summary={defaults} />

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">評価対象一覧</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {defaults.members.map((member) => (
            <a
              key={member.userId}
              href={`/evaluations/finalize?evaluationPeriodId=${defaults.evaluationPeriodId}&memberId=${member.userId}`}
              className={`rounded-2xl border px-4 py-3 text-sm ${member.userId === defaults.selectedUserId ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-800"}`}
            >
              <p className="font-semibold"><span style={{ color: member.userId === defaults.selectedUserId ? "#ffffff" : "#0f172a" }}>{member.name}</span></p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>{member.teamName}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>状態: {member.status}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>総合: {member.overallGradeName} / 期待充足ランク: {member.finalRating}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>自律: {member.itSkillGradeName} / 協調: {member.businessSkillGradeName}</p>
            </a>
          ))}
        </div>
      </section>


      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">上長総括コメント</h3>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{defaults.managerComment || "上長コメントはありません。"}</p>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">自律成長力の最終評価</h3>
            <p className="mt-1 text-sm text-slate-600">自律成長力全体に対する最終コメントを入力します。</p>
          </div>
          <button type="button" onClick={() => setShowSelfGrowthDetails((current) => !current)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
            {showSelfGrowthDetails ? "本人・上長の詳細を閉じる" : "本人・上長の詳細を表示"}
          </button>
        </div>
        <textarea
          value={selfGrowthReview.comment}
          disabled={!canEdit || isPending}
          onChange={(event) => setSelfGrowthReview((current) => ({ ...current, comment: event.target.value }))}
          rows={5}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          placeholder="自律成長力全体に対する最終コメントを入力"
        />
        {showSelfGrowthDetails ? renderReferenceItems(selfGrowthItems, false) : null}
      </section>

      <section className="rounded-3xl border border-sky-200 bg-sky-50/70 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">協調相乗力の最終評価</h3>
            <p className="mt-1 text-sm text-slate-600">協調相乗力全体に対する最終コメントを入力します。</p>
          </div>
          <button type="button" onClick={() => setShowSynergyDetails((current) => !current)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
            {showSynergyDetails ? "本人・上長の詳細を閉じる" : "本人・上長の詳細を表示"}
          </button>
        </div>
        <textarea
          value={synergyReview.comment}
          disabled={!canEdit || isPending}
          onChange={(event) => setSynergyReview((current) => ({ ...current, comment: event.target.value }))}
          rows={5}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          placeholder="協調相乗力全体に対する最終コメントを入力"
        />
        {showSynergyDetails ? renderReferenceItems(synergyItems, true) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">最終総括コメント</h3>
        <textarea
          value={finalComment}
          disabled={!canEdit || isPending}
          onChange={(event) => setFinalComment(event.target.value)}
          rows={5}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          placeholder="最終評価の総括コメントを入力"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "最終評価を確定"}
        </button>
        <span className="text-sm text-slate-500">現在の参考評価点: {liveTotal}</span>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
