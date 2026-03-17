"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { SalarySimulationBundle } from "@/lib/salary-simulations/salary-simulation-service";

type SalarySimulationEditorProps = {
  canEdit: boolean;
  canApprove: boolean;
  canApply: boolean;
  defaults: SalarySimulationBundle;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function escapeCsv(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function requiresAdjustmentReason(newSalary: number, finalSalaryReference: number, threshold: number) {
  return Math.abs(newSalary - finalSalaryReference) >= threshold;
}

export function SalarySimulationEditor({ canEdit, canApprove, canApply, defaults }: SalarySimulationEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState(defaults.rows);
  const [message, setMessage] = useState<string | null>(null);
  const [showOnlyOutOfRange, setShowOnlyOutOfRange] = useState(false);
  const [showOnlyLargeDiff, setShowOnlyLargeDiff] = useState(false);
  const [showOnlyMissingReason, setShowOnlyMissingReason] = useState(false);
  const [largeDiffThreshold, setLargeDiffThreshold] = useState(10000);
  const [isPending, startSaving] = useTransition();

  async function handleSave() {
    setMessage(null);

    const invalidRows = rows.filter(
      (row) => requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) && !row.adjustmentReason.trim(),
    );
    if (invalidRows.length > 0) {
      setMessage(`差額が大きい行は調整理由が必要です: ${invalidRows.map((row) => row.employeeName).join("、")}`);
      return;
    }

    startSaving(async () => {
      const response = await fetch("/api/salary-simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationPeriodId: defaults.evaluationPeriodId,
          rows: rows.map((row) => ({
            userId: row.userId,
            newSalary: row.newSalary,
            adjustmentReason: row.adjustmentReason,
          })),
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));
      if (response.ok) router.refresh();
    });
  }

  async function handleApprove() {
    setMessage(null);

    const invalidRows = rows.filter(
      (row) => requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) && !row.adjustmentReason.trim(),
    );
    if (invalidRows.length > 0) {
      setMessage(`差額が大きい行の調整理由を入力してから承認してください: ${invalidRows.map((row) => row.employeeName).join("、")}`);
      return;
    }

    startSaving(async () => {
      const response = await fetch("/api/salary-simulations/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationPeriodId: defaults.evaluationPeriodId }),
      });
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "承認しました" : "承認に失敗しました"));
      if (response.ok) router.refresh();
    });
  }

  function handleExportCsv() {
    const headers = ["評価期間", "氏名", "チーム", "総合等級", "自律成長等級", "協調相乗等級", "自律成長基準額", "協調相乗基準額", "基準基本給", "粗利達成率", "粗利補正係数", "新月額(参考)", "決定額", "差額", "差率", "調整理由", "参考評価点", "期待充足ランク", "推奨下限昇給率", "推奨上限昇給率", "判定", "現在月額", "昇給率", "昇給額", "状態"];
    const lines = [
      headers.join(","),
      ...visibleRows.map((row) => [
        defaults.periodName,
        row.employeeName,
        row.teamName,
        row.overallGradeName,
        row.selfGrowthGradeCode,
        row.synergyGradeCode,
        row.selfGrowthBaseAmount,
        row.synergyBaseAmount,
        row.baseSalaryReference,
        row.grossProfitAchievementRate,
        row.grossProfitMultiplier,
        row.finalSalaryReference,
        row.newSalary,
        row.newSalary - row.finalSalaryReference,
        row.finalSalaryReference === 0 ? 0 : round(((row.newSalary - row.finalSalaryReference) / row.finalSalaryReference) * 100),
        row.adjustmentReason,
        row.finalScoreTotal,
        row.finalRating,
        row.recommendedMinRaiseRate,
        row.recommendedMaxRaiseRate,
        row.isWithinRecommendedRange ? "レンジ内" : "レンジ外",
        row.currentSalary,
        row.proposedRaiseRate,
        row.proposedRaiseAmount,
        row.status,
      ].map(escapeCsv).join(",")),
    ];

    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `salary-simulation-${defaults.evaluationPeriodId}${showOnlyOutOfRange ? "-out-of-range" : ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleApply() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/salary-simulations/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationPeriodId: defaults.evaluationPeriodId }),
      });
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "反映しました" : "反映に失敗しました"));
      if (response.ok) router.refresh();
    });
  }

  function updateDecisionSalary(userId: string, nextSalary: number) {
    setRows((current) =>
      current.map((item) => {
        if (item.userId !== userId) {
          return item;
        }

        const proposedRaiseAmount = round(nextSalary - item.currentSalary);
        const proposedRaiseRate = item.currentSalary === 0 ? 0 : round((proposedRaiseAmount / item.currentSalary) * 100);

        return {
          ...item,
          newSalary: nextSalary,
          proposedRaiseAmount,
          proposedRaiseRate,
          isWithinRecommendedRange: proposedRaiseRate >= item.recommendedMinRaiseRate && proposedRaiseRate <= item.recommendedMaxRaiseRate,
        };
      }),
    );
  }

  function updateAdjustmentReason(userId: string, adjustmentReason: string) {
    setRows((current) => current.map((item) => (item.userId === userId ? { ...item, adjustmentReason } : item)));
  }

  const totalRaise = rows.reduce((sum, row) => sum + row.proposedRaiseAmount, 0);
  const missingReasonCount = rows.filter((row) => requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) && !row.adjustmentReason.trim()).length;
  const visibleRows = rows.filter((row) => {
    const matchesRange = showOnlyOutOfRange ? !row.isWithinRecommendedRange : true;
    const diffAmount = Math.abs(row.newSalary - row.finalSalaryReference);
    const matchesLargeDiff = showOnlyLargeDiff ? diffAmount >= largeDiffThreshold : true;
    const matchesMissingReason = showOnlyMissingReason ? requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) && !row.adjustmentReason.trim() : true;
    return matchesRange && matchesLargeDiff && matchesMissingReason;
  });

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">昇給シミュレーション</h2>
          <p className="mt-1 text-sm text-slate-500">総合等級を主基準とし、期待充足ランクは現在の役割期待に対する充足度を見る補助基準として昇給率と昇給額を試算します。給与構成設定の自律成長基準額、協調相乗基準額、粗利補正係数も併せて参照します。B は低評価ではなく、現在の役割期待を安定して満たしている状態として扱います。</p>
        </div>
        {!canEdit && !canApprove && !canApply ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">評価期間</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{defaults.periodName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象人数</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{rows.length} 名</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">昇給総額</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{totalRaise.toLocaleString("ja-JP")} 円</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">理由未入力</p>
          <p className="mt-2 text-lg font-semibold text-amber-700">{missingReasonCount} 件</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyOutOfRange}
              onChange={(event) => setShowOnlyOutOfRange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            レンジ外のみ表示
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyLargeDiff}
              onChange={(event) => setShowOnlyLargeDiff(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            差額が大きい行のみ表示
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyMissingReason}
              onChange={(event) => setShowOnlyMissingReason(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            理由未入力のみ表示
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            差額基準
            <input
              type="number"
              min="0"
              step="1000"
              value={largeDiffThreshold}
              onChange={(event) => setLargeDiffThreshold(toNumber(event.target.value))}
              className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            円以上
          </label>
        </div>
        <p className="text-sm text-slate-500">表示件数: {visibleRows.length} / {rows.length}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[2350px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">チーム</th>
                <th className="px-4 py-3 font-medium">総合等級</th>
                <th className="px-4 py-3 font-medium">自律成長</th>
                <th className="px-4 py-3 font-medium">協調相乗</th>
                <th className="px-4 py-3 font-medium">自律成長基準額</th>
                <th className="px-4 py-3 font-medium">協調相乗基準額</th>
                <th className="px-4 py-3 font-medium">基準基本給</th>
                <th className="px-4 py-3 font-medium">粗利達成率</th>
                <th className="px-4 py-3 font-medium">粗利補正</th>
                <th className="px-4 py-3 font-medium">新月額(参考)</th>
                <th className="px-4 py-3 font-medium">決定額</th>
                <th className="px-4 py-3 font-medium">差額</th>
                <th className="px-4 py-3 font-medium">差率</th>
                <th className="px-4 py-3 font-medium">調整理由</th>
                <th className="px-4 py-3 font-medium">参考評価点</th>
                <th className="px-4 py-3 font-medium">期待充足ランク</th>
                <th className="px-4 py-3 font-medium">推奨レンジ</th>
                <th className="px-4 py-3 font-medium">判定</th>
                <th className="px-4 py-3 font-medium">現在月額</th>
                <th className="px-4 py-3 font-medium">昇給率</th>
                <th className="px-4 py-3 font-medium">昇給額</th>
                <th className="px-4 py-3 font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.userId} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-950">{row.employeeName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.overallGradeName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.selfGrowthGradeCode}</td>
                  <td className="px-4 py-3 text-slate-700">{row.synergyGradeCode}</td>
                  <td className="px-4 py-3 text-slate-700">{row.selfGrowthBaseAmount.toLocaleString("ja-JP")} 円</td>
                  <td className="px-4 py-3 text-slate-700">{row.synergyBaseAmount.toLocaleString("ja-JP")} 円</td>
                  <td className="px-4 py-3 text-slate-700">{row.baseSalaryReference.toLocaleString("ja-JP")} 円</td>
                  <td className="px-4 py-3 text-slate-700">{row.grossProfitAchievementRate}%</td>
                  <td className="px-4 py-3 text-slate-700">{row.grossProfitMultiplier}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{row.finalSalaryReference.toLocaleString("ja-JP")} 円</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.newSalary}
                      disabled={!canEdit || isPending}
                      onChange={(event) => updateDecisionSalary(row.userId, toNumber(event.target.value))}
                      className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className={`px-4 py-3 font-semibold ${row.newSalary - row.finalSalaryReference === 0 ? "text-slate-700" : row.newSalary - row.finalSalaryReference > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {(row.newSalary - row.finalSalaryReference > 0 ? "+" : "") + (row.newSalary - row.finalSalaryReference).toLocaleString("ja-JP")} 円
                  </td>
                  <td className={`px-4 py-3 font-semibold ${row.newSalary - row.finalSalaryReference === 0 ? "text-slate-700" : row.newSalary - row.finalSalaryReference > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {(row.finalSalaryReference === 0 ? 0 : round(((row.newSalary - row.finalSalaryReference) / row.finalSalaryReference) * 100)) > 0 ? "+" : ""}
                    {row.finalSalaryReference === 0 ? 0 : round(((row.newSalary - row.finalSalaryReference) / row.finalSalaryReference) * 100)}%
                  </td>
                  <td className="px-4 py-3">
                    <textarea
                      value={row.adjustmentReason}
                      disabled={!canEdit || isPending}
                      onChange={(event) => updateAdjustmentReason(row.userId, event.target.value)}
                      placeholder={requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) ? "差額が大きいため理由を入力" : "必要に応じて入力"}
                      className={`min-h-[72px] w-56 rounded-xl border px-3 py-2 text-sm ${requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) && !row.adjustmentReason.trim() ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
                    />
                    {requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) ? <p className="mt-1 text-xs text-amber-700">差額基準以上のため調整理由が必要です</p> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.finalScoreTotal}</td>
                  <td className="px-4 py-3 text-slate-700">{row.finalRating}</td>
                  <td className="px-4 py-3 text-slate-700">{row.recommendedMinRaiseRate}% - {row.recommendedMaxRaiseRate}%</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.isWithinRecommendedRange ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {row.isWithinRecommendedRange ? "レンジ内" : "レンジ外"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.currentSalary.toLocaleString("ja-JP")} 円</td>
                  <td className="px-4 py-3 text-slate-700">{row.proposedRaiseRate}%</td>
                  <td className="px-4 py-3 text-slate-700">{row.proposedRaiseAmount.toLocaleString("ja-JP")} 円</td>
                  <td className="px-4 py-3 text-slate-700">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleExportCsv} disabled={visibleRows.length === 0 || isPending} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 disabled:border-slate-200 disabled:text-slate-300">
          CSV出力
        </button>
        {canEdit ? (
          <button type="button" onClick={handleSave} disabled={isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
            {isPending ? "処理中..." : "シミュレーションを保存"}
          </button>
        ) : null}
        {canApprove ? (
          <button type="button" onClick={handleApprove} disabled={isPending} className="rounded-full border border-slate-400 px-5 py-2 text-sm font-semibold text-slate-800 disabled:border-slate-200 disabled:text-slate-300">
            社長承認
          </button>
        ) : null}
        {canApply ? (
          <button type="button" onClick={handleApply} disabled={isPending} className="rounded-full border border-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-700 disabled:border-slate-200 disabled:text-slate-300">
            社員コストへ反映
          </button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
