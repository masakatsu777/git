"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EvidenceInputList } from "@/components/evaluations/evidence-input-list";
import { downloadCsv } from "@/lib/client/csv";
import type { EvaluationEvidence, SelfReviewBundle, SelfReviewItem } from "@/lib/evaluations/self-review-service";

type SelfReviewEditorProps = {
  canEdit: boolean;
  defaults: SelfReviewBundle;
};

type CategoryStatus = "UNTOUCHED" | "CHALLENGING" | "CLEARED";

type CategoryGroup = {
  key: string;
  axis: SelfReviewItem["axis"];
  majorCategory: string;
  items: SelfReviewItem[];
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
  return Math.round(items.reduce((sum, item) => sum + item.score * item.weight, 0) * 100) / 100;
}

function sortItems<T extends { majorCategoryOrder: number; minorCategoryOrder: number; displayOrder: number; evaluationItemId: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      left.majorCategoryOrder - right.majorCategoryOrder ||
      left.minorCategoryOrder - right.minorCategoryOrder ||
      left.displayOrder - right.displayOrder ||
      left.evaluationItemId.localeCompare(right.evaluationItemId, "ja"),
  );
}

function groupByMajorCategory(items: SelfReviewItem[]) {
  const sortedItems = sortItems(items);
  const map = new Map<string, CategoryGroup>();

  for (const item of sortedItems) {
    const key = `${item.axis}:${item.majorCategory}`;
    const current = map.get(key);
    if (current) {
      current.items.push(item);
      continue;
    }

    map.set(key, {
      key,
      axis: item.axis,
      majorCategory: item.majorCategory,
      items: [item],
    });
  }

  return Array.from(map.values());
}

function hasEvidenceValue(evidence: EvaluationEvidence) {
  return Boolean(evidence.summary.trim() || evidence.targetName.trim() || evidence.periodNote.trim());
}

function getCategoryStatus(items: SelfReviewItem[]): CategoryStatus {
  if (items.length === 0) {
    return "UNTOUCHED";
  }

  if (items[0]?.axis === "SELF_GROWTH") {
    if (items.every((item) => item.score === 2)) {
      return "CLEARED";
    }
    if (items.some((item) => item.score >= 1)) {
      return "CHALLENGING";
    }
    return "UNTOUCHED";
  }

  if (items.every((item) => item.score === 1)) {
    return "CLEARED";
  }
  if (items.some((item) => item.score >= 1)) {
    return "CHALLENGING";
  }
  return "UNTOUCHED";
}

function getCategoryStatusLabel(status: CategoryStatus) {
  switch (status) {
    case "CLEARED":
      return "クリア";
    case "CHALLENGING":
      return "チャレンジ中";
    default:
      return "未着手";
  }
}

function getCategoryStatusTone(status: CategoryStatus, axis: SelfReviewItem["axis"]) {
  if (status === "CLEARED") {
    return axis === "SELF_GROWTH" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800";
  }
  if (status === "CHALLENGING") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-600";
}

function getCategoryProgressLabel(items: SelfReviewItem[]) {
  const completedCount = items.filter((item) => item.score >= 1).length;
  return `${completedCount} / ${items.length} 項目`;
}

function getMinorCategorySummary(items: SelfReviewItem[]) {
  return Array.from(new Set(items.map((item) => item.minorCategory))).join(" / ");
}

export function SelfReviewEditor({ canEdit, defaults }: SelfReviewEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState(defaults.items);
  const [selfComment, setSelfComment] = useState(defaults.selfComment);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const total = useMemo(() => calculateTotal(items), [items]);
  const selfGrowthItems = useMemo(() => items.filter((item) => item.axis === "SELF_GROWTH"), [items]);
  const synergyItems = useMemo(() => items.filter((item) => item.axis === "SYNERGY"), [items]);
  const selfGrowthCategories = useMemo(() => groupByMajorCategory(selfGrowthItems), [selfGrowthItems]);
  const synergyCategories = useMemo(() => groupByMajorCategory(synergyItems), [synergyItems]);

  function toggleCategory(key: string) {
    setExpandedCategories((current) => ({ ...current, [key]: !current[key] }));
  }

  function updateItem(itemId: string, patch: Partial<SelfReviewItem>) {
    setItems((current) => current.map((row) => (row.evaluationItemId === itemId ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    setMessage(null);

    const missingEvidenceItems = items.filter(
      (item) =>
        item.axis === "SYNERGY" &&
        item.evidenceRequired &&
        item.score === 1 &&
        !item.evidences.some(hasEvidenceValue),
    );

    if (missingEvidenceItems.length > 0) {
      setMessage("協調相乗力で継続実践できているを選んだ項目は、少なくとも1件の継続実践の根拠を入力してください。");
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

  function handleExportCsv() {
    const rows = sortItems(items).map((item) => [
      defaults.periodName,
      item.axis === "SELF_GROWTH" ? "自律成長力" : "協調相乗力",
      item.majorCategory,
      item.minorCategory,
      item.title,
      item.score,
      item.weight,
      item.comment,
      item.evidenceRequired ? "必須" : "任意",
      item.evidences.map((evidence, index) => `${index + 1}. ${evidence.summary} / ${evidence.targetName} / ${evidence.periodNote}`).join(" | "),
      selfComment,
    ]);

    downloadCsv(
      `self-review-${defaults.evaluationPeriodId}.csv`,
      ["評価期間", "評価軸", "大分類", "小分類", "項目名", "自己評価点", "重み", "コメント", "根拠必須", "根拠一覧", "総括コメント"],
      rows,
    );
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">自己評価入力</h2>

        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm text-emerald-700">入力受付中</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象期間</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{defaults.periodName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">ステータス</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{canEdit ? "入力受付中" : "閲覧専用"}</p>
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
        <p className="mt-1 text-sm text-slate-600">前回上長評価でクリアだった大分類は、初期値として 2 が入ることがあります。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {selfGrowthGuide.map((guide) => (
            <article key={guide.score} className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">{guide.score}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.label}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 space-y-4">
          {selfGrowthCategories.map((group) => {
            const status = getCategoryStatus(group.items);
            const expanded = Boolean(expandedCategories[group.key]);
            return (
              <section key={group.key} className="rounded-3xl border border-emerald-200/80 bg-white/90 p-4">
                <button
                  type="button"
                  onClick={() => toggleCategory(group.key)}
                  className="flex w-full items-start justify-between gap-4 text-left"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">自律成長力</span>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getCategoryStatusTone(status, group.axis)}`}>{getCategoryStatusLabel(status)}</span>
                    </div>
                    <h4 className="mt-3 text-lg font-semibold text-slate-950">{group.majorCategory}</h4>
                    <p className="mt-1 text-sm text-slate-500">{getCategoryProgressLabel(group.items)} / {getMinorCategorySummary(group.items)}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600">{expanded ? "閉じる" : "開く"}</span>
                </button>
                {expanded ? (
                  <div className="mt-5 space-y-4">
                    {group.items.map((item) => (
                      <article key={item.evaluationItemId} className="rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.9))] p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] text-emerald-700">1 / 2 評価</span>
                              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{item.minorCategory}</p>
                            </div>
                            <h5 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h5>
                            <p className="mt-1 text-sm text-slate-500">重み {item.weight}</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {selfGrowthGuide.map((guide) => (
                              <label key={`${item.evaluationItemId}-${guide.score}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={item.evaluationItemId}
                                  checked={item.score === guide.score}
                                  disabled={!canEdit || isPending}
                                  onChange={() => updateItem(item.evaluationItemId, { score: guide.score })}
                                />
                                {guide.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <textarea
                          value={item.comment}
                          disabled={!canEdit || isPending}
                          onChange={(event) => updateItem(item.evaluationItemId, { comment: event.target.value })}
                          rows={3}
                          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          placeholder="評価理由や補足を入力"
                        />
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-300 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(224,242,254,0.88))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div>
          <span className="inline-flex items-center rounded-full border border-sky-300 bg-white/85 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700">協調相乗力 / 継続実践評価</span>
          <h3 className="mt-3 font-semibold text-slate-950">協調相乗力</h3>
          <p className="mt-1 text-sm text-slate-600">継続実践を確認します。</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {synergyGuide.map((guide) => (
            <article key={guide.score} className="rounded-2xl border border-sky-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">{guide.score}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.label}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">単発ではなく、継続的に実践しているかどうかがポイントです。</p>
        <div className="mt-6 space-y-4">
          {synergyCategories.map((group) => {
            const status = getCategoryStatus(group.items);
            const expanded = Boolean(expandedCategories[group.key]);
            return (
              <section key={group.key} className="rounded-3xl border border-sky-200/80 bg-white/90 p-4">
                <button
                  type="button"
                  onClick={() => toggleCategory(group.key)}
                  className="flex w-full items-start justify-between gap-4 text-left"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700">協調相乗力</span>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getCategoryStatusTone(status, group.axis)}`}>{getCategoryStatusLabel(status)}</span>
                    </div>
                    <h4 className="mt-3 text-lg font-semibold text-slate-950">{group.majorCategory}</h4>
                    <p className="mt-1 text-sm text-slate-500">{getCategoryProgressLabel(group.items)} / {getMinorCategorySummary(group.items)}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600">{expanded ? "閉じる" : "開く"}</span>
                </button>
                {expanded ? (
                  <div className="mt-5 space-y-4">
                    {group.items.map((item) => (
                      <article key={item.evaluationItemId} className="rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.88))] p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] text-sky-700">継続実践</span>
                              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{item.minorCategory}</p>
                            </div>
                            <h5 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h5>
                            <p className="mt-1 text-sm text-slate-500">重み {item.weight}{item.evidenceRequired ? " / 継続実践の根拠必須" : ""}</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {synergyGuide.map((guide) => (
                              <label key={`${item.evaluationItemId}-${guide.score}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={item.evaluationItemId}
                                  checked={item.score === guide.score}
                                  disabled={!canEdit || isPending}
                                  onChange={() => updateItem(item.evaluationItemId, { score: guide.score })}
                                />
                                {guide.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <EvidenceInputList
                          disabled={!canEdit || isPending || item.score !== 1}
                          evidences={item.evidences}
                          required={item.evidenceRequired && item.score === 1}
                          onChange={(next: EvaluationEvidence[]) => updateItem(item.evaluationItemId, { evidences: next })}
                        />
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
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
          placeholder="全体の振り返り、成果、課題、次期に向けた改善を入力"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleExportCsv} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700">
          CSV出力
        </button>
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "自己評価を保存"}
        </button>
        <span className="text-sm text-slate-500">現在の加重点: {total}</span>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
