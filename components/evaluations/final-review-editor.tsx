"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EvidenceInputList } from "@/components/evaluations/evidence-input-list";
import { ExpectedFulfillmentRankGuide } from "@/components/evaluations/expected-fulfillment-rank-guide";
import type { EvaluationEvidence } from "@/lib/evaluations/self-review-service";
import type { FinalReviewBundle, FinalReviewItem } from "@/lib/evaluations/final-review-service";

type FinalReviewEditorProps = {
  canEdit: boolean;
  defaults: FinalReviewBundle;
};

const selfGrowthGuide = [
  { score: 0, label: "これから習得する段階" },
  { score: 1, label: "完全ではないができる" },
  { score: 2, label: "問題なくできる" },
] as const;

const synergyGuide = [
  { score: 0, label: "継続実践には至っていない" },
  { score: 1, label: "継続実践できている" },
] as const;

function calculateTotal(items: Array<{ score: number; weight: number }>) {
  return Math.round(items.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0) * 100) / 100;
}

function deriveRating(score: number) {
  if (score >= 1.7) return "S";
  if (score >= 1.45) return "A";
  if (score >= 1.15) return "B";
  if (score >= 0.85) return "C";
  return "D";
}

function groupByMajorCategory(items: FinalReviewItem[]) {
  const map = new Map<string, FinalReviewItem[]>();
  for (const item of items) {
    const current = map.get(item.majorCategory) ?? [];
    current.push(item);
    map.set(item.majorCategory, current);
  }
  return Array.from(map.entries());
}

export function FinalReviewEditor({ canEdit, defaults }: FinalReviewEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState(defaults.items);
  const [finalComment, setFinalComment] = useState(defaults.finalComment);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  const selfGrowthItems = useMemo(() => items.filter((item) => item.axis === "SELF_GROWTH"), [items]);
  const synergyItems = useMemo(() => items.filter((item) => item.axis === "SYNERGY"), [items]);
  const liveTotal = useMemo(() => calculateTotal(items.map((item) => ({ score: item.finalScore, weight: item.weight }))), [items]);
  const liveRating = liveTotal > 0 ? deriveRating(liveTotal) : "-";

  async function handleSave() {
    setMessage(null);

    const missingEvidenceItems = items.filter(
      (item) =>
        item.axis === "SYNERGY" &&
        item.evidenceRequired &&
        item.finalScore === 1 &&
        (!item.finalComment.trim() || !item.evidences.some((evidence) => evidence.summary.trim() || evidence.targetName.trim() || evidence.periodNote.trim())),
    );
    if (missingEvidenceItems.length > 0) {
      setMessage("協調相乗力で継続実践できているを選んだ項目は、最終コメントと少なくとも1件の根拠を入力してください。");
      return;
    }

    startSaving(async () => {
      const response = await fetch("/api/evaluations/final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationPeriodId: defaults.evaluationPeriodId,
          userId: defaults.selectedUserId,
          finalComment,
          items: items.map((item) => ({
            evaluationItemId: item.evaluationItemId,
            score: item.finalScore,
            comment: item.finalComment,
            evidences: item.evidences,
          })),
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
          <p className="mt-1 text-sm text-slate-500">自己評価と上長評価を踏まえ、自律成長力と協調相乗力を最終確定します。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        <div className="rounded-2xl bg-emerald-50 px-4 py-4">
          <p className="text-sm text-slate-500">自律成長力達成率</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.selfGrowthProgress}%</p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-4">
          <p className="text-sm text-slate-500">協調相乗力実施率</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.synergyProgress}%</p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-4 py-4">
          <p className="text-sm text-slate-500">総合等級</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.overallGradeName}</p>
          <p className="mt-1 text-sm text-slate-500">自律成長等級と協調相乗等級のマトリクスで算出します。</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">自律成長等級</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.itSkillGradeName}</p>
          <p className="mt-1 text-sm text-slate-500">達成率 {defaults.itSkillScore}% / 次: {defaults.nextItSkillGradeName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">協調相乗等級</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.businessSkillGradeName}</p>
          <p className="mt-1 text-sm text-slate-500">実施率 {defaults.businessSkillScore}% / 次: {defaults.nextBusinessSkillGradeName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">自己評価点</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.selfScoreTotal}</p>
          <p className="mt-1 text-sm text-slate-500">補助情報</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">上長評価点</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.managerScoreTotal}</p>
          <p className="mt-1 text-sm text-slate-500">補助情報</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">参考評価点</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{liveTotal}</p>
          <p className="mt-1 text-sm text-slate-500">現在の役割期待に対する充足度を補助的に表す参考値です。</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">期待充足ランク</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{liveRating}</p>
          <p className="mt-1 text-sm text-slate-500">現在の役割期待をどの程度満たしているかを見る補助指標です。B は低評価ではなく、現在の役割期待を安定して満たしている状態として扱います。</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">評価対象一覧</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {defaults.members.map((member) => (
            <a
              key={member.userId}
              href={`/evaluations/finalize?memberId=${member.userId}`}
              className={`rounded-2xl border px-4 py-3 text-sm ${member.userId === defaults.selectedUserId ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-800"}`}
            >
              <p className="font-semibold">{member.name}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>{member.teamName}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>状態: {member.status}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>総合: {member.overallGradeName} / 期待充足ランク: {member.finalRating}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>自律: {member.itSkillGradeName} / 協調: {member.businessSkillGradeName}</p>
            </a>
          ))}
        </div>
      </section>

      <ExpectedFulfillmentRankGuide />

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="font-semibold text-slate-950">自律成長力</h3>
        <p className="mt-1 text-sm text-slate-600">仕事を通じて必要とされる存在になる力を最終確定します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {selfGrowthGuide.map((guide) => (
            <article key={guide.score} className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">{guide.score}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.label}</p>
            </article>
          ))}

        </div>
      </section>

      <div className="space-y-5">
        {groupByMajorCategory(selfGrowthItems).map(([majorCategory, groupedItems]) => (
          <section key={majorCategory} className="rounded-3xl border border-slate-200 p-4">
            <h3 className="text-lg font-semibold text-slate-950">{majorCategory}</h3>
            <div className="mt-4 space-y-4">
              {groupedItems.map((item) => (
                <article key={item.evaluationItemId} className="rounded-2xl bg-slate-50 p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.minorCategory}</p>
                      <h4 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h4>
                      <p className="mt-1 text-sm text-slate-500">自己 {item.selfScore} / 重み {item.weight}</p>
                      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{item.selfComment || "自己コメントなし"}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-sm text-slate-500">上長 {item.managerScore}</p>
                      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{item.managerComment || "上長コメントなし"}</p>
                    </div>
                    <div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selfGrowthGuide.map((guide) => (
                          <label key={`${item.evaluationItemId}-${guide.score}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name={item.evaluationItemId}
                              checked={item.finalScore === guide.score}
                              disabled={!canEdit || isPending}
                              onChange={() => setItems((current) => current.map((row) => row.evaluationItemId === item.evaluationItemId ? { ...row, finalScore: guide.score } : row))}
                            />
                            {guide.label}
                          </label>
                        ))}
                      </div>
                      <textarea
                        value={item.finalComment}
                        disabled={!canEdit || isPending}
                        onChange={(event) => setItems((current) => current.map((row) => row.evaluationItemId === item.evaluationItemId ? { ...row, finalComment: event.target.value } : row))}
                        rows={4}
                        className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        placeholder="最終コメントを入力"
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
        <h3 className="font-semibold text-slate-950">協調相乗力</h3>
        <p className="mt-1 text-sm text-slate-600">単発ではなく、半期を通じた継続実践になっているかを最終確定します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {synergyGuide.map((guide) => (
            <article key={guide.score} className="rounded-2xl border border-sky-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">{guide.score}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.label}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="space-y-5">
        {groupByMajorCategory(synergyItems).map(([majorCategory, groupedItems]) => (
          <section key={majorCategory} className="rounded-3xl border border-slate-200 p-4">
            <h3 className="text-lg font-semibold text-slate-950">{majorCategory}</h3>
            <div className="mt-4 space-y-4">
              {groupedItems.map((item) => (
                <article key={item.evaluationItemId} className="rounded-2xl bg-slate-50 p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.minorCategory}</p>
                      <h4 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h4>
                      <p className="mt-1 text-sm text-slate-500">自己 {item.selfScore} / 重み {item.weight} / 継続実践を評価{item.evidenceRequired ? " / 根拠コメント必須" : ""}</p>
                      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{item.selfComment || "自己コメントなし"}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-sm text-slate-500">上長 {item.managerScore}</p>
                      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{item.managerComment || "上長コメントなし"}</p>
                    </div>
                    <div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {synergyGuide.map((guide) => (
                          <label key={`${item.evaluationItemId}-${guide.score}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name={item.evaluationItemId}
                              checked={item.finalScore === guide.score}
                              disabled={!canEdit || isPending}
                              onChange={() => setItems((current) => current.map((row) => row.evaluationItemId === item.evaluationItemId ? { ...row, finalScore: guide.score } : row))}
                            />
                            {guide.label}
                          </label>
                        ))}
                      </div>
                      <textarea
                        value={item.finalComment}
                        disabled={!canEdit || isPending}
                        onChange={(event) => setItems((current) => current.map((row) => row.evaluationItemId === item.evaluationItemId ? { ...row, finalComment: event.target.value } : row))}
                        rows={4}
                        className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        placeholder={item.evidenceRequired ? "継続実践の事実、頻度、成果を最終コメントとして必ず入力" : "継続実践の事実、頻度、成果を最終コメントとして入力"}
                      />
                      <EvidenceInputList
                        disabled={!canEdit || isPending || item.finalScore !== 1}
                        evidences={item.evidences}
                        required={item.evidenceRequired && item.finalScore === 1}
                        onChange={(next: EvaluationEvidence[]) =>
                          setItems((current) =>
                            current.map((row) =>
                              row.evaluationItemId === item.evaluationItemId ? { ...row, evidences: next } : row,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

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
