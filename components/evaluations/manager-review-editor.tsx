"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  ManagerCategoryReviewStatus,
  ManagerExpectedFulfillmentRank,
  ManagerReviewBundle,
  ManagerReviewItem,
} from "@/lib/evaluations/manager-review-service";

type ManagerReviewEditorProps = {
  canEdit: boolean;
  defaults: ManagerReviewBundle;
};

type SelfGrowthCategoryDecision = "NOT_STARTED" | "CHALLENGING" | "CLEARED";
type SynergyCategoryDecision = "NOT_PRACTICING" | "PARTIALLY_PRACTICING" | "PRACTICING";
type OverallManagerStatus = "IN_REVIEW" | "REVISION_REQUESTED" | "APPROVED";

type CategoryGroup = {
  key: string;
  axis: ManagerReviewItem["axis"];
  majorCategory: string;
  majorCategoryOrder: number;
  items: ManagerReviewItem[];
};

const selfGrowthGuide = [
  { value: "NOT_STARTED", label: "未着手", description: "大分類全体として着手前" },
  { value: "CHALLENGING", label: "チャレンジ中", description: "大分類全体として前進中" },
  { value: "CLEARED", label: "クリア", description: "大分類全体として問題なくできている" },
] as const;

const synergyGuide = [
  { value: "NOT_PRACTICING", label: "継続実践なし", description: "大分類全体として継続実践には至っていない" },
  { value: "PARTIALLY_PRACTICING", label: "一部継続実践", description: "大分類内の一部項目で継続実践できている" },
  { value: "PRACTICING", label: "継続実践中", description: "大分類全体として継続実践できている" },
] as const;

const expectedFulfillmentRankOptions = [
  { value: "A", label: "A", description: "役割期待を上回っている" },
  { value: "B", label: "B", description: "役割期待通り" },
  { value: "C", label: "C", description: "役割期待に不足がある" },
] as const;

const MANAGER_CATEGORY_META_PREFIX = "__MANAGER_CATEGORY_META__";
const MANAGER_OVERALL_META_PREFIX = "__MANAGER_OVERALL_META__";

function encodeManagerCategoryComment(comment: string, reviewStatus: ManagerCategoryReviewStatus) {
  const trimmed = comment.trim();
  return `${MANAGER_CATEGORY_META_PREFIX}${JSON.stringify({ reviewStatus })}\n${trimmed}`;
}

function encodeManagerOverallComment(comment: string, expectedFulfillmentRank: ManagerExpectedFulfillmentRank) {
  const trimmed = comment.trim();
  return `${MANAGER_OVERALL_META_PREFIX}${JSON.stringify({ expectedFulfillmentRank })}\n${trimmed}`;
}

function calculateTotal(items: Array<{ score: number; weight: number }>) {
  return Math.round(items.reduce((sum, item) => sum + item.score * item.weight, 0) * 100) / 100;
}

function groupByMajorCategory(items: ManagerReviewItem[]) {
  const sorted = [...items].sort(
    (left, right) =>
      left.majorCategoryOrder - right.majorCategoryOrder ||
      left.minorCategoryOrder - right.minorCategoryOrder ||
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
      majorCategoryOrder: item.majorCategoryOrder,
      items: [item],
    });
  }
  return Array.from(map.values());
}

function hasSavedManagerScores(items: ManagerReviewItem[]) {
  return items.some((item) => item.managerScore > 0 || item.managerComment.trim() || item.managerReviewStatus !== "PENDING");
}

function getSelfGrowthDecision(items: ManagerReviewItem[]): SelfGrowthCategoryDecision {
  const sourceScores = items.map((item) => item.managerScore);

  if (sourceScores.every((score) => score === 2)) {
    return "CLEARED";
  }
  if (sourceScores.some((score) => score >= 1)) {
    return "CHALLENGING";
  }
  return "NOT_STARTED";
}

function getSynergyDecision(items: ManagerReviewItem[]): SynergyCategoryDecision {
  const sourceScores = items.map((item) => item.managerScore);

  if (sourceScores.every((score) => score >= 1)) {
    return "PRACTICING";
  }
  if (sourceScores.some((score) => score >= 1)) {
    return "PARTIALLY_PRACTICING";
  }
  return "NOT_PRACTICING";
}

function getCategoryComment(items: ManagerReviewItem[]) {
  return items.find((item) => item.managerComment.trim())?.managerComment ?? "";
}

function getCategoryReviewStatus(items: ManagerReviewItem[]): ManagerCategoryReviewStatus {
  return items.find((item) => item.managerReviewStatus === "REVISION_REQUESTED")?.managerReviewStatus
    ?? items.find((item) => item.managerReviewStatus === "APPROVED")?.managerReviewStatus
    ?? "PENDING";
}

function getSelfSummary(items: ManagerReviewItem[]) {
  const scoreSummary = items.map((item) => `${item.minorCategory}:${item.selfScore}`).join(" / ");
  return scoreSummary || "自己評価なし";
}

function getDetailTone(axis: ManagerReviewItem["axis"]) {
  return axis === "SELF_GROWTH"
    ? {
        border: "border-emerald-100",
        box: "bg-emerald-50/60",
        badge: "text-emerald-700",
      }
    : {
        border: "border-sky-100",
        box: "bg-sky-50/60",
        badge: "text-sky-700",
      };
}

function getMemberStatusLabel(status: string) {
  switch (status) {
    case "SELF_REVIEW":
      return "自己評価中";
    case "MANAGER_REVIEW":
      return "上長評価中";
    case "FINAL_REVIEW":
      return "最終評価中";
    case "FINALIZED":
      return "確定済み";
    default:
      return status;
  }
}

function getReviewStatusLabel(status: ManagerCategoryReviewStatus) {
  switch (status) {
    case "REVISION_REQUESTED":
      return "確認依頼中";
    case "APPROVED":
      return "承認済み";
    default:
      return "上長確認中";
  }
}

function getReviewStatusTone(status: ManagerCategoryReviewStatus) {
  switch (status) {
    case "REVISION_REQUESTED":
      return "bg-amber-100 text-amber-800";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getOverallStatus(groups: CategoryGroup[]): OverallManagerStatus {
  const statuses = groups.map((group) => getCategoryReviewStatus(group.items));
  if (statuses.includes("REVISION_REQUESTED")) {
    return "REVISION_REQUESTED";
  }
  if (statuses.length > 0 && statuses.every((status) => status === "APPROVED")) {
    return "APPROVED";
  }
  return "IN_REVIEW";
}

function getOverallStatusLabel(status: OverallManagerStatus) {
  switch (status) {
    case "REVISION_REQUESTED":
      return "確認依頼あり";
    case "APPROVED":
      return "承認";
    default:
      return "上長確認中";
  }
}

function getOverallStatusTone(status: OverallManagerStatus) {
  switch (status) {
    case "REVISION_REQUESTED":
      return "bg-amber-100 text-amber-800";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function initializeManagerItems(items: ManagerReviewItem[]) {
  const groups = groupByMajorCategory(items);
  const initialized = new Map<string, ManagerReviewItem>();

  for (const group of groups) {
    const useSavedManager = hasSavedManagerScores(group.items);
    for (const item of group.items) {
      initialized.set(item.evaluationItemId, useSavedManager ? item : { ...item, managerScore: item.selfScore });
    }
  }

  return items.map((item) => initialized.get(item.evaluationItemId) ?? item);
}

export function ManagerReviewEditor({ canEdit, defaults }: ManagerReviewEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState(() => initializeManagerItems(defaults.items));
  const [managerComment, setManagerComment] = useState(defaults.managerComment);
  const [expectedFulfillmentRank, setExpectedFulfillmentRank] = useState<ManagerExpectedFulfillmentRank>(defaults.expectedFulfillmentRank);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();
  const [openedDetails, setOpenedDetails] = useState<Record<string, boolean>>({});

  const selfGrowthItems = useMemo(() => items.filter((item) => item.axis === "SELF_GROWTH"), [items]);
  const synergyItems = useMemo(() => items.filter((item) => item.axis === "SYNERGY"), [items]);
  const selfGrowthCategories = useMemo(() => groupByMajorCategory(selfGrowthItems), [selfGrowthItems]);
  const synergyCategories = useMemo(() => groupByMajorCategory(synergyItems), [synergyItems]);
  const allCategories = useMemo(() => [...selfGrowthCategories, ...synergyCategories], [selfGrowthCategories, synergyCategories]);
  const overallStatus = useMemo(() => getOverallStatus(allCategories), [allCategories]);
  const managerTotal = useMemo(() => calculateTotal(items.map((item) => ({ score: item.managerScore, weight: item.weight }))), [items]);
  const selfGrowthProgress = useMemo(() => calculateTotal(selfGrowthItems.map((item) => ({ score: item.managerScore, weight: item.weight }))) / Math.max(1, calculateTotal(selfGrowthItems.map((item) => ({ score: item.maxScore, weight: item.weight })))) * 100, [selfGrowthItems]);
  const synergyProgress = useMemo(() => calculateTotal(synergyItems.map((item) => ({ score: item.managerScore, weight: item.weight }))) / Math.max(1, calculateTotal(synergyItems.map((item) => ({ score: item.maxScore, weight: item.weight })))) * 100, [synergyItems]);

  function updateCategoryScores(categoryItems: ManagerReviewItem[], nextDecision: number | SynergyCategoryDecision) {
    const ids = new Set(categoryItems.map((item) => item.evaluationItemId));
    setItems((current) => current.map((row) => {
      if (!ids.has(row.evaluationItemId)) {
        return row;
      }

      if (typeof nextDecision === "number") {
        return { ...row, managerScore: nextDecision };
      }

      if (nextDecision === "PRACTICING") {
        return { ...row, managerScore: 1 };
      }

      if (nextDecision === "NOT_PRACTICING") {
        return { ...row, managerScore: 0 };
      }

      const categoryIndex = categoryItems.findIndex((item) => item.evaluationItemId === row.evaluationItemId);
      const fallbackHasPositive = categoryItems.some((item) => item.selfScore >= 1);
      const nextScore = row.selfScore >= 1 ? 1 : (!fallbackHasPositive && categoryIndex === 0 ? 1 : 0);
      return { ...row, managerScore: nextScore };
    }));
  }

  function updateCategoryComment(categoryItems: ManagerReviewItem[], nextComment: string) {
    const ids = new Set(categoryItems.map((item) => item.evaluationItemId));
    setItems((current) => current.map((row) => (ids.has(row.evaluationItemId) ? { ...row, managerComment: nextComment } : row)));
  }

  function updateCategoryReviewStatus(categoryItems: ManagerReviewItem[], nextStatus: ManagerCategoryReviewStatus) {
    const ids = new Set(categoryItems.map((item) => item.evaluationItemId));
    setItems((current) => current.map((row) => (ids.has(row.evaluationItemId) ? { ...row, managerReviewStatus: nextStatus } : row)));
  }

  function toggleDetails(key: string) {
    setOpenedDetails((current) => ({ ...current, [key]: !current[key] }));
  }

  function saveWithMode(mode: "save" | "approve") {
    setMessage(null);

    if (mode === "approve" && overallStatus !== "APPROVED") {
      setMessage("全体承認するには、すべての大分類を承認済みにしてください。確認依頼中の大分類がある場合は承認できません。");
      return;
    }

    startSaving(async () => {
      const response = await fetch("/api/evaluations/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationPeriodId: defaults.evaluationPeriodId,
          userId: defaults.selectedUserId,
          teamId: defaults.teamId,
          managerComment: encodeManagerOverallComment(managerComment, expectedFulfillmentRank),
          submitMode: mode,
          items: items.map((item) => ({
            evaluationItemId: item.evaluationItemId,
            score: item.managerScore,
            comment: encodeManagerCategoryComment(item.managerComment, item.managerReviewStatus),
            evidences: [],
          })),
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? (mode === "approve" ? "承認しました" : "下書き保存しました") : "保存に失敗しました"));

      if (response.ok) {
        router.refresh();
      }
    });
  }

  function renderCategory(group: CategoryGroup) {
    const isSelfGrowth = group.axis === "SELF_GROWTH";
    const decision = isSelfGrowth ? getSelfGrowthDecision(group.items) : getSynergyDecision(group.items);
    const comment = getCategoryComment(group.items);
    const categoryReviewStatus = getCategoryReviewStatus(group.items);
    const detailTone = getDetailTone(group.axis);
    const detailsOpen = Boolean(openedDetails[group.key]);
    const guides = isSelfGrowth ? selfGrowthGuide : synergyGuide;

    return (
      <section key={group.key} className={`rounded-3xl border p-4 ${isSelfGrowth ? "border-emerald-200/80 bg-white/90" : "border-sky-200/80 bg-white/90"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] ${isSelfGrowth ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                {isSelfGrowth ? "自律成長力" : "協調相乗力"}
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{group.items.length} 項目</span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getReviewStatusTone(categoryReviewStatus)}`}>{getReviewStatusLabel(categoryReviewStatus)}</span>
            </div>
            <h4 className="mt-3 text-lg font-semibold text-slate-950">{group.majorCategory}</h4>
            <p className="mt-1 text-sm text-slate-500">本人入力: {getSelfSummary(group.items)}</p>
          </div>
          <button
            type="button"
            onClick={() => toggleDetails(group.key)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            {detailsOpen ? "本人入力を閉じる" : "本人入力を表示"}
          </button>
        </div>

        {detailsOpen ? (
          <div className={`mt-4 space-y-3 rounded-2xl border bg-white/80 p-4 ${detailTone.border}`}>
            <p className="text-sm font-semibold text-slate-950">本人入力の詳細</p>
            <div className="space-y-3">
              {group.items.map((item) => (
                <article key={`${group.key}-${item.evaluationItemId}-self`} className={`rounded-2xl px-4 py-3 text-sm text-slate-700 ${detailTone.box}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] ${detailTone.badge}`}>{item.minorCategory}</span>
                    <span className="text-xs text-slate-500">自己評価 {item.selfScore}</span>
                  </div>
                  <p className="mt-2 font-medium text-slate-900">{item.title}</p>
                  <p className="mt-2 whitespace-pre-wrap leading-6">{item.selfComment || "本人コメントは未入力です。"}</p>
                  {item.axis === "SYNERGY" && item.evidences.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold tracking-[0.16em] text-slate-500">本人の根拠</p>
                      {item.evidences.map((evidence, index) => (
                        <div key={`${item.evaluationItemId}-evidence-${index}`} className="rounded-xl bg-white px-3 py-3 text-xs leading-6 text-slate-700">
                          <p>{evidence.summary || "要約なし"}</p>
                          {evidence.targetName ? <p>対象: {evidence.targetName}</p> : null}
                          {evidence.periodNote ? <p>{evidence.periodNote}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className={`mt-4 grid gap-2 ${isSelfGrowth ? "md:grid-cols-3" : "md:grid-cols-3"}`}>
          {guides.map((guide) => (
            <label key={`${group.key}-${guide.value}`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="radio"
                name={group.key}
                checked={decision === guide.value}
                disabled={!canEdit || isPending}
                onChange={() => {
                  if (isSelfGrowth) {
                    const nextScore = guide.value === "CLEARED" ? 2 : guide.value === "CHALLENGING" ? 1 : 0;
                    updateCategoryScores(group.items, nextScore);
                    return;
                  }

                  updateCategoryScores(group.items, guide.value as SynergyCategoryDecision);
                }}
              />
              <span>
                <span className="block font-semibold text-slate-950">{guide.label}</span>
                <span className="block text-xs text-slate-500">{guide.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canEdit || isPending}
            onClick={() => updateCategoryReviewStatus(group.items, "REVISION_REQUESTED")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${categoryReviewStatus === "REVISION_REQUESTED" ? "bg-amber-500 text-white" : "border border-amber-200 bg-white text-amber-700"}`}
          >
            確認依頼
          </button>
          <button
            type="button"
            disabled={!canEdit || isPending}
            onClick={() => updateCategoryReviewStatus(group.items, "APPROVED")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${categoryReviewStatus === "APPROVED" ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-white text-emerald-700"}`}
          >
            承認
          </button>
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
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">上長評価入力</h2>
          <p className="mt-1 text-sm text-slate-500">大分類ごとに判定、確認依頼、承認を管理しながら上長評価を進めます。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm text-emerald-700">入力受付中</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象期間</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.periodName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象者</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.selectedUserName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">全体状態</p>
          <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getOverallStatusTone(overallStatus)}`}>{getOverallStatusLabel(overallStatus)}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-4">
          <p className="text-sm text-slate-500">自律成長力達成率</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{Math.round(selfGrowthProgress * 100) / 100}%</p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-4">
          <p className="text-sm text-slate-500">協調相乗力実施率</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{Math.round(synergyProgress * 100) / 100}%</p>
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
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>状態: {getMemberStatusLabel(member.status)}</p>
              <p className={`mt-1 ${member.userId === defaults.selectedUserId ? "text-slate-200" : "text-slate-500"}`}>自己 {member.selfScoreTotal} / 上長 {member.managerScoreTotal}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">本人の総括コメント</h3>
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">{defaults.selfComment || "本人の総括コメントは未入力です。"}</div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="font-semibold text-slate-950">自律成長力</h3>
        <p className="mt-1 text-sm text-slate-600">大分類単位で未着手・チャレンジ中・クリアを判定し、必要なら確認依頼、問題なければ承認します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {selfGrowthGuide.map((guide) => (
            <article key={guide.value} className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">{guide.label}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 space-y-4">{selfGrowthCategories.map(renderCategory)}</div>
      </section>

      <section className="rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
        <h3 className="font-semibold text-slate-950">協調相乗力</h3>
        <p className="mt-1 text-sm text-slate-600">大分類単位で継続実践の有無を判定し、本人の根拠を参照しながら確認依頼または承認を行います。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {synergyGuide.map((guide) => (
            <article key={guide.value} className="rounded-2xl border border-sky-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">{guide.label}</p>
              <p className="mt-2 font-semibold text-slate-950">{guide.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 space-y-4">{synergyCategories.map(renderCategory)}</div>
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">総括フィードバック</h3>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">期待充足ランク</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {expectedFulfillmentRankOptions.map((option) => (
              <label key={option.value} className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <input
                  type="radio"
                  name="expectedFulfillmentRank"
                  checked={expectedFulfillmentRank === option.value}
                  disabled={!canEdit || isPending}
                  onChange={() => setExpectedFulfillmentRank(option.value)}
                />
                <span>
                  <span className="block font-semibold text-slate-950">{option.label}</span>
                  <span className="block text-xs text-slate-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
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
        <button type="button" onClick={() => saveWithMode("save")} disabled={!canEdit || isPending} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">
          {isPending ? "処理中..." : "下書き保存"}
        </button>
        <button type="button" onClick={() => saveWithMode("approve")} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "全体を承認して保存"}
        </button>
        <span className="text-sm text-slate-500">現在の上長評価加重点: {managerTotal}</span>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
