"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EvidenceInputList } from "@/components/evaluations/evidence-input-list";
import type { EvaluationEvidence } from "@/lib/evaluations/self-review-service";
import type { ManagerReviewBundle, ManagerReviewItem } from "@/lib/evaluations/manager-review-service";

type ManagerReviewEditorProps = {
  canEdit: boolean;
  defaults: ManagerReviewBundle;
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

function groupByMajorCategory(items: ManagerReviewItem[]) {
  const map = new Map<string, ManagerReviewItem[]>();
  for (const item of items) {
    const current = map.get(item.majorCategory) ?? [];
    current.push(item);
    map.set(item.majorCategory, current);
  }
  return Array.from(map.entries());
}

export function ManagerReviewEditor({ canEdit, defaults }: ManagerReviewEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState(defaults.items);
  const [managerComment, setManagerComment] = useState(defaults.managerComment);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  const selfGrowthItems = useMemo(() => items.filter((item) => item.axis === "SELF_GROWTH"), [items]);
  const synergyItems = useMemo(() => items.filter((item) => item.axis === "SYNERGY"), [items]);
  const managerTotal = useMemo(() => calculateTotal(items.map((item) => ({ score: item.managerScore, weight: item.weight }))), [items]);

  async function handleSave() {
    setMessage(null);

    const missingEvidenceItems = items.filter(
      (item) =>
        item.axis === "SYNERGY" &&
        item.evidenceRequired &&
        item.managerScore === 1 &&
        (!item.managerComment.trim() || !item.evidences.some((evidence) => evidence.summary.trim() || evidence.targetName.trim() || evidence.periodNote.trim())),
    );
    if (missingEvidenceItems.length > 0) {
      setMessage("協調相乗力で継続実践できているを選んだ項目は、上長コメントと少なくとも1件の根拠を入力してください。");
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
          managerComment,
          items: items.map((item) => ({
            evaluationItemId: item.evaluationItemId,
            score: item.managerScore,
            comment: item.managerComment,
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
          <h2 className="text-xl font-semibold text-slate-950">上長評価入力</h2>
          <p className="mt-1 text-sm text-slate-500">自己評価を参照しながら、自律成長力と協調相乗力を上長視点で評価します。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
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
              href={`/evaluations/team?memberId=${member.userId}`}
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
        <p className="mt-1 text-sm text-slate-600">仕事を通じて必要とされる存在になる力を上長視点で確認します。</p>
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
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.minorCategory}</p>
                      <h4 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h4>
                      <p className="mt-1 text-sm text-slate-500">自己評価 {item.selfScore} / 重み {item.weight}</p>
                      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{item.selfComment || "自己評価コメントなし"}</p>
                    </div>
                    <div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selfGrowthGuide.map((guide) => (
                          <label key={`${item.evaluationItemId}-${guide.score}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name={item.evaluationItemId}
                              checked={item.managerScore === guide.score}
                              disabled={!canEdit || isPending}
                              onChange={() => setItems((current) => current.map((row) => row.evaluationItemId === item.evaluationItemId ? { ...row, managerScore: guide.score } : row))}
                            />
                            {guide.label}
                          </label>
                        ))}
                      </div>
                      <textarea
                        value={item.managerComment}
                        disabled={!canEdit || isPending}
                        onChange={(event) => setItems((current) => current.map((row) => row.evaluationItemId === item.evaluationItemId ? { ...row, managerComment: event.target.value } : row))}
                        rows={4}
                        className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        placeholder="上長コメントを入力"
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
        <p className="mt-1 text-sm text-slate-600">単発ではなく、半期を通じた継続実践になっているかを上長視点で評価します。</p>
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
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.minorCategory}</p>
                      <h4 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h4>
                      <p className="mt-1 text-sm text-slate-500">自己評価 {item.selfScore} / 重み {item.weight} / 継続実践を評価{item.evidenceRequired ? " / 根拠コメント必須" : ""}</p>
                      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{item.selfComment || "自己評価コメントなし"}</p>
                    </div>
                    <div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {synergyGuide.map((guide) => (
                          <label key={`${item.evaluationItemId}-${guide.score}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name={item.evaluationItemId}
                              checked={item.managerScore === guide.score}
                              disabled={!canEdit || isPending}
                              onChange={() => setItems((current) => current.map((row) => row.evaluationItemId === item.evaluationItemId ? { ...row, managerScore: guide.score } : row))}
                            />
                            {guide.label}
                          </label>
                        ))}
                      </div>
                      <textarea
                        value={item.managerComment}
                        disabled={!canEdit || isPending}
                        onChange={(event) => setItems((current) => current.map((row) => row.evaluationItemId === item.evaluationItemId ? { ...row, managerComment: event.target.value } : row))}
                        rows={4}
                        className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        placeholder={item.evidenceRequired ? "継続実践の事実、頻度、成果を上長コメントとして必ず入力" : "継続実践の事実、頻度、成果を上長コメントとして入力"}
                      />
                      <EvidenceInputList
                        disabled={!canEdit || isPending || item.managerScore !== 1}
                        evidences={item.evidences}
                        required={item.evidenceRequired && item.managerScore === 1}
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
