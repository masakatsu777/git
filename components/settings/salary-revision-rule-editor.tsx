"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ExpectedFulfillmentRankGuide } from "@/components/evaluations/expected-fulfillment-rank-guide";
import type { SalaryRevisionRuleBundle, SalaryRevisionRuleRow } from "@/lib/salary-rules/salary-revision-rule-service";

type SalaryRevisionRuleEditorProps = {
  canEdit: boolean;
  defaults: SalaryRevisionRuleBundle;
  title?: string;
  description?: string;
  ruleLabel?: string;
  saveLabel?: string;
  endpoint?: string;
  rankDescriptions?: Record<string, string>;
  recommendedRules?: ReadonlyArray<Pick<SalaryRevisionRuleRow, "rating" | "minRaise" | "maxRaise" | "defaultRaise">>;
  showExpectedFulfillmentGuide?: boolean;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const expectedFulfillmentRankDescriptions: Record<string, string> = {
  S: "現在の役割期待を大きく上回っている",
  A: "現在の役割期待を上回っている",
  B: "現在の役割期待を安定して満たしている",
  C: "現在の役割期待に一部不足がある",
  D: "現在の役割期待に明確な不足がある",
};

const recommendedExpectedFulfillmentRules = [
  { rating: "S", minRaise: 6, maxRaise: 10, defaultRaise: 8 },
  { rating: "A", minRaise: 4, maxRaise: 8, defaultRaise: 6 },
  { rating: "B", minRaise: 2, maxRaise: 5, defaultRaise: 4 },
  { rating: "C", minRaise: 0, maxRaise: 3, defaultRaise: 2 },
  { rating: "D", minRaise: 0, maxRaise: 1, defaultRaise: 0 },
] as const;

export function SalaryRevisionRuleEditor({
  canEdit,
  defaults,
  title = "昇給ルール設定",
  description = "期待充足ランクごとの下限、上限、標準昇給率を設定します。期待充足ランクは現在の役割期待に対する充足度を見る補助基準として扱います。B は低評価ではなく、現在の役割期待を安定して満たしている状態として扱います。",
  ruleLabel = "期待充足ランク",
  saveLabel = "昇給ルールを保存",
  endpoint = "/api/salary-revision-rules",
  rankDescriptions = expectedFulfillmentRankDescriptions,
  recommendedRules = recommendedExpectedFulfillmentRules,
  showExpectedFulfillmentGuide = true,
}: SalaryRevisionRuleEditorProps) {
  const router = useRouter();
  const [rules, setRules] = useState(defaults.rules);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  function addRule() {
    setRules((current) => [
      ...current,
      { id: `new-rule-${crypto.randomUUID()}`, rating: "", minRaise: 0, maxRaise: 0, defaultRaise: 0 },
    ]);
  }

  function applyRecommendedRules() {
    setRules((current) => {
      const existingByRating = new Map(current.map((rule) => [rule.rating.trim().toUpperCase(), rule]));
      return recommendedRules.map((rule) => ({
        id: existingByRating.get(rule.rating.trim().toUpperCase())?.id ?? `new-rule-${crypto.randomUUID()}`,
        rating: rule.rating,
        minRaise: rule.minRaise,
        maxRaise: rule.maxRaise,
        defaultRaise: rule.defaultRaise,
      }));
    });
    setMessage("おすすめ初期値を表に反映しました。内容を確認してから保存してください。");
  }

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationPeriodId: defaults.evaluationPeriodId, rules }),
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
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {showExpectedFulfillmentGuide ? <ExpectedFulfillmentRankGuide /> : null}

      <div className="rounded-3xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">対象評価期間</p>
            <p className="text-base font-semibold text-slate-950">{defaults.periodName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={applyRecommendedRules} disabled={!canEdit || isPending} className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">
              おすすめ初期値を入れる
            </button>
            <button type="button" onClick={addRule} disabled={!canEdit || isPending} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:border-slate-200 disabled:text-slate-400">
              ルールを追加
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{ruleLabel}</th>
                <th className="px-4 py-3 font-medium">意味</th>
                <th className="px-4 py-3 font-medium">下限昇給率</th>
                <th className="px-4 py-3 font-medium">上限昇給率</th>
                <th className="px-4 py-3 font-medium">標準昇給率</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((row: SalaryRevisionRuleRow) => {
                const normalizedRating = row.rating.trim().toUpperCase();
                return (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.rating}
                        disabled={!canEdit || isPending}
                        onChange={(event) =>
                          setRules((current) => current.map((item) => (item.id === row.id ? { ...item, rating: event.target.value } : item)))
                        }
                        className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{rankDescriptions[normalizedRating] ?? "自由入力"}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={row.minRaise}
                        disabled={!canEdit || isPending}
                        onChange={(event) =>
                          setRules((current) => current.map((item) => (item.id === row.id ? { ...item, minRaise: toNumber(event.target.value) } : item)))
                        }
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={row.maxRaise}
                        disabled={!canEdit || isPending}
                        onChange={(event) =>
                          setRules((current) => current.map((item) => (item.id === row.id ? { ...item, maxRaise: toNumber(event.target.value) } : item)))
                        }
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={row.defaultRaise}
                        disabled={!canEdit || isPending}
                        onChange={(event) =>
                          setRules((current) => current.map((item) => (item.id === row.id ? { ...item, defaultRaise: toNumber(event.target.value) } : item)))
                        }
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : saveLabel}
        </button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
