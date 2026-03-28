"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ManagerReviewBundle, ManagerReviewItem } from "@/lib/evaluations/manager-review-service";

type ManagerReviewEditorProps = {
  canEdit: boolean;
  defaults: ManagerReviewBundle;
};

type SelfGrowthCategoryDecision = "NOT_STARTED" | "CHALLENGING" | "CLEARED";
type SynergyCategoryDecision = "NOT_PRACTICING" | "PRACTICING";

type CategoryGroup = {
  key: string;
  axis: ManagerReviewItem["axis"];
  majorCategory: string;
  items: ManagerReviewItem[];
};

const selfGrowthGuide = [
  { value: "NOT_STARTED", label: "未着手", description: "大分類全体として着手前" },
  { value: "CHALLENGING", label: "チャレンジ中", description: "大分類全体として前進中" },
  { value: "CLEARED", label: "クリア", description: "大分類全体として問題なくできている" },
] as const;

const synergyGuide = [
  { value: "NOT_PRACTICING", label: "継続実践なし", description: "大分類全体として継続実践には至っていない" },
  { value: "PRACTICING", label: "継続実践あり", description: "大分類全体として継続実践できている" },
] as const;

function calculateTotal(items: Array<{ score: number; weight: number }>) {
  return Math.round(items.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0) * 100) / 100;
}

function groupByMajorCategory(items: ManagerReviewItem[]) {
  const sorted = [...items].sort(
    (left, right) =>
      left.majorCategory.localeCompare(right.majorCategory, "ja") ||
      left.minorCategory.localeCompare(right.minorCategory, "ja") ||
      left.evaluationItemId.localeCompare(right.evaluationItemId, "ja"),
  );

  const map = new Map<string, CategoryGroup>();
  for (const item of sorted) {
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

function getSelfGrowthDecision(items: ManagerReviewItem[]): SelfGrowthCategoryDecision {
  if (items.every((item) => item.managerScore === 2)) {
    return "CLEARED";
  }
  if (items.some((item) => item.managerScore >= 1)) {
    return "CHALLENGING";
  }
  return "NOT_STARTED";
}

function getSynergyDecision(items: ManagerReviewItem[]): SynergyCategoryDecision {
  return items.some((item) => item.managerScore >= 1) ? "PRACTICING" : "NOT_PRACTICING";
}

function getCategoryComment(items: ManagerReviewItem[]) {
  return items.find((item) => item.managerComment.trim())?.managerComment ?? "";
}

function getSelfSummary(items: ManagerReviewItem[]) {
  const scoreSummary = items.map((item) => `${item.minorCategory}:${item.selfScore}`).join(" / ");
  return scoreSummary || "自己評価なし";
}

export function ManagerReviewEditor({ canEdit, defaults }: ManagerReviewEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState(defaults.items);
  const [managerComment, setManagerComment] = useState(defaults.managerComment);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  const selfGrowthItems = useMemo(() => items.filter((item) => item.axis === "SELF_GROWTH"), [items]);
  const synergyItems = useMemo(() => items.filter((item) => item.axis === "SYNERGY"), [items]);
  const selfGrowthCategories = useMemo(() => groupByMajorCategory(selfGrowthItems), [selfGrowthItems]);
  const synergyCategories = useMemo(() => groupByMajorCategory(synergyItems), [synergyItems]);
  const managerTotal = useMemo(() => calculateTotal(items.map((item) => ({ score: item.managerScore, weight: item.weight }))), [items]);

  function updateCategoryScores(categoryItems: ManagerReviewItem[], nextScore: number) {
    const ids = new Set(categoryItems.map((item) => item.evaluationItemId));
    setItems((current) => current.map((row) => (ids.has(row.evaluationItemId) ? { ...row, managerScore: nextScore } : row)));
  }

  function updateCategoryComment(categoryItems: ManagerReviewItem[], nextComment: string) {
    const ids = new Set(categoryItems.map((item) => item.evaluationItemId));
    setItems((current) => current.map((row) => (ids.has(row.evaluationItemId) ? { ...row, managerComment: nextComment } : row)));
  }

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/evaluations/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationPeriodId: defaults.evaluationPeriodId,
          userId: defaults.selectedUserId,
          teamId: defaults.teamId,
          managerComment,
          items: items.map((item) => ({
            evaluationItemId: item.evaluationItemId,
            score: item.managerScore,
            comment: item.managerComment,
            evidences: [],
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
          <h2 className="text-xl font-semibold text-slate-950">上長評価入力</h2>
          <p className="mt-1 text-sm text-slate-500">大分類ごとに判定とコメントを入力し、必要に応じて本人へ確認しやすい形に整えます。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm text-emerald-700">入力受付中</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象期間</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.periodName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象者</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.selectedUserName}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-4">
          <p className="text-sm text-slate-500">自律成長力達成率</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.selfGrowthProgress}%</p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-4">
          <p className="text-sm text-slate-500">協調相乗力実施率</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.synergyProgress}%</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">対象メンバー</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {defaults.members.map((member) => (
            <a
              key={member.userId}
              href={`/evaluations/team?evaluationPeriodId=${defaults.evaluationPeriodId}&teamId=${defaults.teamId}&memberId=${member.userId}`}
              className={`rounded-2xl border px-4 py-3 text-sm ${member.userId === defaults.selectedUserId ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-800"}`}
            >
              <p className="font-semibold"><span style={{ color: member.userId === defaults.selectedUserId ? "#ffffff" : "#0f172a" }}>{member.name}</span></p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>状態: {member.status}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>自己 {member.selfScoreTotal} / 上長 {member.managerScoreTotal}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="font-semibold text-slate-950">自律成長力</h3>
        <p className="mt-1 text-sm text-slate-600">大分類単位で未着手・チャレンジ中・クリアを判定し、コメントを入力します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {selfGrowthGuide.map((guide) => (
            <article key={guide.value} className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">{guide.label}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 space-y-4">
          {selfGrowthCategories.map((group) => {
            const decision = getSelfGrowthDecision(group.items);
            const comment = getCategoryComment(group.items);
            return (
              <section key={group.key} className="rounded-3xl border border-emerald-200/80 bg-white/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">自律成長力</span>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{group.items.length} 項目</span>
                    </div>
                    <h4 className="mt-3 text-lg font-semibold text-slate-950">{group.majorCategory}</h4>
                    <p className="mt-1 text-sm text-slate-500">本人入力: {getSelfSummary(group.items)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {selfGrowthGuide.map((guide) => (
                    <label key={`${group.key}-${guide.value}`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="radio"
                        name={group.key}
                        checked={decision === guide.value}
                        disabled={!canEdit || isPending}
                        onChange={() => updateCategoryScores(group.items, guide.value === "CLEARED" ? 2 : guide.value === "CHALLENGING" ? 1 : 0)}
                      />
                      <span>
                        <span className="block font-semibold text-slate-950">{guide.label}</span>
                        <span className="block text-xs text-slate-500">{guide.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={comment}
                  disabled={!canEdit || isPending}
                  onChange={(event) => updateCategoryComment(group.items, event.target.value)}
                  rows={4}
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="大分類単位の上長コメントを入力"
                />
              </section>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
        <h3 className="font-semibold text-slate-950">協調相乗力</h3>
        <p className="mt-1 text-sm text-slate-600">大分類単位で継続実践の有無を判定し、コメントを入力します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {synergyGuide.map((guide) => (
            <article key={guide.value} className="rounded-2xl border border-sky-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">{guide.label}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 space-y-4">
          {synergyCategories.map((group) => {
            const decision = getSynergyDecision(group.items);
            const comment = getCategoryComment(group.items);
            return (
              <section key={group.key} className="rounded-3xl border border-sky-200/80 bg-white/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700">協調相乗力</span>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{group.items.length} 項目</span>
                    </div>
                    <h4 className="mt-3 text-lg font-semibold text-slate-950">{group.majorCategory}</h4>
                    <p className="mt-1 text-sm text-slate-500">本人入力: {getSelfSummary(group.items)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {synergyGuide.map((guide) => (
                    <label key={`${group.key}-${guide.value}`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="radio"
                        name={group.key}
                        checked={decision === guide.value}
                        disabled={!canEdit || isPending}
                        onChange={() => updateCategoryScores(group.items, guide.value === "PRACTICING" ? 1 : 0)}
                      />
                      <span>
                        <span className="block font-semibold text-slate-950">{guide.label}</span>
                        <span className="block text-xs text-slate-500">{guide.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={comment}
                  disabled={!canEdit || isPending}
                  onChange={(event) => updateCategoryComment(group.items, event.target.value)}
                  rows={4}
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="大分類単位の上長コメントを入力"
                />
              </section>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">総括フィードバック</h3>
        <textarea
          value={managerComment}
          disabled={!canEdit || isPending}
          onChange={(event) => setManagerComment(event.target.value)}
          rows={5}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          placeholder="半期全体の評価、期待、次期へのフィードバックを入力"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "上長評価を保存"}
        </button>
        <span className="text-sm text-slate-500">現在の上長評価加重点: {managerTotal}</span>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
