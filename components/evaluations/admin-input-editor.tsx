"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EvidenceInputList } from "@/components/evaluations/evidence-input-list";
import type { AdminInputBundle, AdminInputItem } from "@/lib/evaluations/admin-input-service";

type AdminInputEditorProps = {
  canEdit: boolean;
  defaults: AdminInputBundle;
};

type CategoryGroup = {
  key: string;
  axis: AdminInputItem["axis"];
  majorCategory: string;
  items: AdminInputItem[];
};

const adminGuide = [
  { score: 0, label: "非該当" },
  { score: 1, label: "該当" },
] as const;

function sortItems<T extends { majorCategoryOrder: number; minorCategoryOrder: number; displayOrder: number; evaluationItemId: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      left.majorCategoryOrder - right.majorCategoryOrder ||
      left.minorCategoryOrder - right.minorCategoryOrder ||
      left.displayOrder - right.displayOrder ||
      left.evaluationItemId.localeCompare(right.evaluationItemId, "ja"),
  );
}

function groupByMajorCategory(items: AdminInputItem[]) {
  const sortedItems = sortItems(items);
  const map = new Map<string, CategoryGroup>();

  for (const item of sortedItems) {
    const key = `${item.axis}:${item.majorCategory}`;
    const current = map.get(key);
    if (current) {
      current.items.push(item);
      continue;
    }
    map.set(key, { key, axis: item.axis, majorCategory: item.majorCategory, items: [item] });
  }

  return Array.from(map.values());
}

function hasEvidenceValue(evidence: AdminInputItem["evidences"][number]) {
  return Boolean(evidence.summary.trim() || evidence.targetName.trim() || evidence.periodNote.trim());
}

function calculateTotal(items: AdminInputItem[]) {
  return Math.round(items.reduce((sum, item) => sum + item.score * item.weight, 0) * 100) / 100;
}

export function AdminInputEditor({ canEdit, defaults }: AdminInputEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState(defaults.items);
  const [selfComment, setSelfComment] = useState(defaults.selfComment);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isPending, startSaving] = useTransition();
  const [isCopyPending, startCopying] = useTransition();

  const total = useMemo(() => calculateTotal(items), [items]);
  const selfGrowthCategories = useMemo(() => groupByMajorCategory(items.filter((item) => item.axis === "SELF_GROWTH")), [items]);
  const synergyCategories = useMemo(() => groupByMajorCategory(items.filter((item) => item.axis === "SYNERGY")), [items]);

  function toggleCategory(key: string) {
    setExpandedCategories((current) => ({ ...current, [key]: !current[key] }));
  }

  function updateItem(itemId: string, patch: Partial<AdminInputItem>) {
    setItems((current) => current.map((item) => (item.evaluationItemId === itemId ? { ...item, ...patch } : item)));
  }

  async function handleSave() {
    setMessage(null);

    const missingEvidenceItems = items.filter(
      (item) => item.evidenceRequired && item.score === 1 && (!item.comment.trim() || !item.evidences.some(hasEvidenceValue)),
    );
    if (missingEvidenceItems.length > 0) {
      setMessage("根拠必須の項目では、コメントと少なくとも1件の根拠を入力してください。");
      return;
    }

    startSaving(async () => {
      const response = await fetch("/api/evaluations/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationPeriodId: defaults.evaluationPeriodId,
          teamId: defaults.teamId,
          userId: defaults.selectedUserId,
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

  async function handleCopyPrevious() {
    setMessage(null);
    startCopying(async () => {
      const response = await fetch("/api/evaluations/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copyPrevious",
          evaluationPeriodId: defaults.evaluationPeriodId,
          teamId: defaults.teamId,
          userId: defaults.selectedUserId,
        }),
      });

      const result = (await response.json()) as { message?: string; data?: AdminInputBundle };
      setMessage(result.message ?? (response.ok ? "前期間からコピーしました" : "コピーに失敗しました"));
      if (response.ok && result.data) {
        setItems(result.data.items);
        setSelfComment(result.data.selfComment);
        router.refresh();
      }
    });
  }

  function renderCategory(group: CategoryGroup) {
    const expanded = Boolean(expandedCategories[group.key]);

    return (
      <section key={group.key} className="rounded-3xl border border-slate-200 bg-white p-4">
        <button type="button" onClick={() => toggleCategory(group.key)} className="flex w-full items-center justify-between gap-4 text-left">
          <div>
            <p className="text-lg font-semibold text-slate-950">{group.majorCategory}</p>
            <p className="mt-1 text-sm text-slate-500">{group.items.length} 項目</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">{expanded ? "閉じる" : "開く"}</span>
        </button>
        {expanded ? (
          <div className="mt-4 space-y-4">
            {group.items.map((item) => (
              <article key={item.evaluationItemId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{item.minorCategory}</p>
                <h4 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h4>
                <p className="mt-1 text-sm text-slate-500">重み: {item.weight}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {adminGuide.map((option) => (
                    <label key={option.score} className={`rounded-2xl border px-4 py-3 text-sm ${item.score === option.score ? "border-brand-300 bg-brand-50 text-slate-950" : "border-slate-200 bg-white text-slate-600"}`}>
                      <input
                        type="radio"
                        name={`score-${item.evaluationItemId}`}
                        value={option.score}
                        checked={item.score === option.score}
                        disabled={!canEdit}
                        onChange={() => updateItem(item.evaluationItemId, { score: option.score })}
                        className="sr-only"
                      />
                      <span className="font-semibold">{option.score}</span>
                      <span className="mt-1 block">{option.label}</span>
                    </label>
                  ))}
                </div>
                <label className="mt-4 block text-sm text-slate-700">
                  コメント
                  <textarea
                    value={item.comment}
                    onChange={(event) => updateItem(item.evaluationItemId, { comment: event.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    placeholder="設定理由や補足を入力してください"
                  />
                </label>
                {item.evidenceRequired ? (
                  <div className="mt-4">
                    <EvidenceInputList
                      disabled={!canEdit}
                      evidences={item.evidences}
                      onChange={(evidences) => updateItem(item.evaluationItemId, { evidences })}
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">評価初期設定</h2>
          <p className="mt-1 text-sm text-slate-500">管理者のみ入力可の項目を、対象社員ごとに設定します。</p>
        </div>
        <span className={`rounded-full px-4 py-2 text-sm ${canEdit ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {canEdit ? "編集可能" : "閲覧専用"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象期間</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{defaults.periodName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象社員</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{defaults.selectedUserName || "未選択"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">ステータス</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{defaults.status}</p>
        </div>
        <div className="rounded-2xl bg-brand-50 px-4 py-4">
          <p className="text-sm text-slate-500">参考合計点</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{total}</p>
        </div>
      </div>

      {defaults.members.length > 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-950">対象メンバー</h3>
              <p className="mt-1 text-sm text-slate-500">前期間からのコピーは、このチームの現行メンバー全員を対象に実行します。</p>
            </div>
            <button
              type="button"
              onClick={handleCopyPrevious}
              disabled={!canEdit || isCopyPending}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCopyPending ? "コピー中..." : "前期間からコピー"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {defaults.members.map((member) => (
              <a
                key={member.userId}
                href={`/evaluations/admin?evaluationPeriodId=${defaults.evaluationPeriodId}&teamId=${defaults.teamId}&memberId=${member.userId}`}
                className={`rounded-2xl border px-4 py-4 ${member.userId === defaults.selectedUserId ? "border-brand-300 bg-white shadow-sm" : "border-slate-200 bg-white/80"}`}
              >
                <p className="font-semibold text-slate-950">{member.name}</p>
                <p className="mt-1 text-sm text-slate-500">状態: {member.status}</p>
                <p className="mt-1 text-sm text-slate-500">参考合計: {member.selfScoreTotal}</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {defaults.selectedUserId ? (
        <>
          <section className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
            <h3 className="font-semibold text-slate-950">自律成長力の初期設定</h3>
            {selfGrowthCategories.map(renderCategory)}
          </section>
          <section className="space-y-4 rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
            <h3 className="font-semibold text-slate-950">協調相乗力の初期設定</h3>
            {synergyCategories.map(renderCategory)}
          </section>
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm text-slate-700">
              管理者総括コメント
              <textarea
                value={selfComment}
                onChange={(event) => setSelfComment(event.target.value)}
                disabled={!canEdit}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                placeholder="初期設定の意図や補足事項を入力してください"
              />
            </label>
          </section>
        </>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">
          対象社員を選択すると、管理者のみ入力可の項目を設定できます。
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{message ?? "管理者のみ入力可の項目は、通常の自己評価画面には表示されません。"}</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || !defaults.selectedUserId || isPending}
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPending ? "保存中..." : "初期設定を保存"}
        </button>
      </div>
    </section>
  );
}
