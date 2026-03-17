"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EvidenceInputList } from "@/components/evaluations/evidence-input-list";
import type { EvaluationEvidence, SelfReviewBundle, SelfReviewItem } from "@/lib/evaluations/self-review-service";

type SelfReviewEditorProps = {
  canEdit: boolean;
  defaults: SelfReviewBundle;
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

function calculateTotal(items: SelfReviewBundle["items"]) {
  return Math.round(items.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0) * 100) / 100;
}

function groupByMajorCategory(items: SelfReviewItem[]) {
  const sortedItems = [...items].sort(
    (left, right) =>
      left.majorCategoryOrder - right.majorCategoryOrder ||
      left.minorCategoryOrder - right.minorCategoryOrder ||
      left.displayOrder - right.displayOrder ||
      left.evaluationItemId.localeCompare(right.evaluationItemId, "ja"),
  );

  const map = new Map<string, SelfReviewItem[]>();
  for (const item of sortedItems) {
    const current = map.get(item.majorCategory) ?? [];
    current.push(item);
    map.set(item.majorCategory, current);
  }
  return Array.from(map.entries());
}

function hasEvidenceValue(evidence: EvaluationEvidence) {
  return Boolean(evidence.summary.trim() || evidence.targetName.trim() || evidence.periodNote.trim());
}

export function SelfReviewEditor({ canEdit, defaults }: SelfReviewEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState(defaults.items);
  const [selfComment, setSelfComment] = useState(defaults.selfComment);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();
  const [showCompletedSelfGrowth, setShowCompletedSelfGrowth] = useState(false);

  const total = useMemo(() => calculateTotal(items), [items]);
  const selfGrowthItems = useMemo(() => items.filter((item) => item.axis === "SELF_GROWTH"), [items]);
  const visibleSelfGrowthItems = useMemo(
    () => (showCompletedSelfGrowth ? selfGrowthItems : selfGrowthItems.filter((item) => item.score !== 2)),
    [selfGrowthItems, showCompletedSelfGrowth],
  );
  const completedSelfGrowthCount = useMemo(
    () => selfGrowthItems.filter((item) => item.score === 2).length,
    [selfGrowthItems],
  );
  const synergyItems = useMemo(() => items.filter((item) => item.axis === "SYNERGY"), [items]);

  async function handleSave() {
    setMessage(null);

    const missingEvidenceItems = items.filter(
      (item) =>
        item.axis === "SYNERGY" &&
        item.evidenceRequired &&
        item.score === 1 &&
        (!item.comment.trim() || !item.evidences.some(hasEvidenceValue)),
    );

    if (missingEvidenceItems.length > 0) {
      setMessage("協調相乗力で継続実践できているを選んだ項目は、根拠コメントと少なくとも1件の根拠を入力してください。");
      return;
    }

    startSaving(async () => {
      const response = await fetch("/api/evaluations/my", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationPeriodId: defaults.evaluationPeriodId,
          selfComment,
          items: items.map((item) => ({
            evaluationItemId: item.evaluationItemId,
            score: item.score,
            comment: item.comment,
            evidences: item.evidences,
          })),
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));

      if (response.ok) {
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">自己評価入力</h2>
          <p className="mt-1 text-sm text-slate-500">自律成長力と協調相乗力を分けて入力し、半期の自己評価を整理します。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象期間</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{defaults.periodName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">ステータス</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{defaults.status}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-4">
          <p className="text-sm text-slate-500">自律成長力達成率</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{defaults.selfGrowthProgress}%</p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-4">
          <p className="text-sm text-slate-500">協調相乗力実施率</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{defaults.synergyProgress}%</p>
        </div>
      </div>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="font-semibold text-slate-950">自律成長力</h3>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>自ら学び、考え、行動し、必要とされる存在になる力を確認します。</p>
          {completedSelfGrowthCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowCompletedSelfGrowth((current) => !current)}
              className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800"
            >
              {showCompletedSelfGrowth ? "未完了のみ表示" : `全項目表示 (${completedSelfGrowthCount}件完了)`}
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {selfGrowthGuide.map((guide) => (
            <article key={guide.score} className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">{guide.score}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.label}</p>
            </article>
          ))}

        </div>
        <div className="mt-6 space-y-4">
          {groupByMajorCategory(visibleSelfGrowthItems).map(([majorCategory, groupedItems]) => (
            <section key={majorCategory} className="rounded-3xl border border-slate-200 p-4">
              <h3 className="text-lg font-semibold text-slate-950">{majorCategory}</h3>
              <div className="mt-4 space-y-4">
                {groupedItems.map((item) => (
                  <article key={item.evaluationItemId} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.minorCategory}</p>
                        <h4 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h4>
                        <p className="mt-1 text-sm text-slate-500">重み {item.weight}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selfGrowthGuide.map((guide) => (
                          <label key={
                            item.evaluationItemId + '-' + guide.score
                          } className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name={item.evaluationItemId}
                              checked={item.score === guide.score}
                              disabled={!canEdit || isPending}
                              onChange={() =>
                                setItems((current) =>
                                  current.map((row) =>
                                    row.evaluationItemId === item.evaluationItemId ? { ...row, score: guide.score } : row,
                                  ),
                                )
                              }
                            />
                            {guide.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={item.comment}
                      disabled={!canEdit || isPending}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((row) =>
                            row.evaluationItemId === item.evaluationItemId ? { ...row, comment: event.target.value } : row,
                          ),
                        )
                      }
                      rows={3}
                      className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      placeholder="評価理由や補足を入力"
                    />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
        <h3 className="font-semibold text-slate-950">協調相乗力</h3>
        <p className="mt-1 text-sm text-slate-600">周囲と力を掛け合わせ、他者や組織に価値を広げる力を確認します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {synergyGuide.map((guide) => (
            <article key={guide.score} className="rounded-2xl border border-sky-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">{guide.score}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.label}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">単発ではなく、半期を通じた継続実践かどうかで評価します。</p>
        <div className="mt-6 space-y-4">
          {groupByMajorCategory(synergyItems).map(([majorCategory, groupedItems]) => (
            <section key={majorCategory} className="rounded-3xl border border-slate-200 p-4">
              <h3 className="text-lg font-semibold text-slate-950">{majorCategory}</h3>
              <div className="mt-4 space-y-4">
                {groupedItems.map((item) => (
                  <article key={item.evaluationItemId} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.minorCategory}</p>
                        <h4 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h4>
                        <p className="mt-1 text-sm text-slate-500">重み {item.weight} / 継続実践を評価{item.evidenceRequired ? " / 根拠コメント必須" : ""}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {synergyGuide.map((guide) => (
                          <label key={
                            item.evaluationItemId + '-' + guide.score
                          } className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name={item.evaluationItemId}
                              checked={item.score === guide.score}
                              disabled={!canEdit || isPending}
                              onChange={() =>
                                setItems((current) =>
                                  current.map((row) =>
                                    row.evaluationItemId === item.evaluationItemId ? { ...row, score: guide.score } : row,
                                  ),
                                )
                              }
                            />
                            {guide.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={item.comment}
                      disabled={!canEdit || isPending}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((row) =>
                            row.evaluationItemId === item.evaluationItemId ? { ...row, comment: event.target.value } : row,
                          ),
                        )
                      }
                      rows={3}
                      className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      placeholder={item.evidenceRequired ? "継続実践の内容、対象、頻度、成果を必ず入力" : "継続実践の内容、対象、頻度、成果を入力"}
                    />
                    <EvidenceInputList
                      disabled={!canEdit || isPending || item.score !== 1}
                      evidences={item.evidences}
                      required={item.evidenceRequired && item.score === 1}
                      onChange={(next: EvaluationEvidence[]) =>
                        setItems((current) =>
                          current.map((row) =>
                            row.evaluationItemId === item.evaluationItemId ? { ...row, evidences: next } : row,
                          ),
                        )
                      }
                    />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">総括コメント</h3>
        <textarea
          value={selfComment}
          disabled={!canEdit || isPending}
          onChange={(event) => setSelfComment(event.target.value)}
          rows={5}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          placeholder="半期全体の振り返り、成果、課題、次期に向けた改善を入力"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "自己評価を保存"}
        </button>
        <span className="text-sm text-slate-500">現在の加重点: {total}</span>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
