"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { SalarySimulationBundle, SalarySimulationRow } from "@/lib/salary-simulations/salary-simulation-service";
import { formatCurrencyWithUnit, formatSignedCurrencyWithUnit } from "@/lib/format/currency";

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

function getManagerState(row: SalarySimulationRow) {
  if (row.status === "APPLIED" || row.status === "APPROVED") return "調整完了";
  if (row.newSalary !== row.finalSalaryReference || row.adjustmentReason.trim()) return "調整済";
  return "未調整";
}

function getExecutiveState(status: string) {
  return status === "APPLIED" || status === "APPROVED" ? "承認済" : "未承認";
}

function getRowActionLabel(row: SalarySimulationRow, canEdit: boolean, canApprove: boolean, canApply: boolean) {
  if (row.status === "APPLIED") return "完了";
  if (row.status === "APPROVED") return canApply ? "反映待ち" : "承認済";
  if (canApprove) return "承認待ち";
  if (canEdit) return "調整入力";
  return "確認";
}

export function SalarySimulationEditor({ canEdit, canApprove, canApply, defaults }: SalarySimulationEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState(defaults.rows);
  const [message, setMessage] = useState<string | null>(null);
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
      setMessage(`調整額が大きい行は理由が必要です: ${invalidRows.map((row) => row.employeeName).join("、")}`);
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
      setMessage(`調整額が大きい行の理由を入力してから承認してください: ${invalidRows.map((row) => row.employeeName).join("、")}`);
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

  function handleExportCsv() {
    const headers = ["評価期間", "氏名", "チーム", "現在給与", "等級", "自動算出昇給額", "最終昇給額", "調整額", "調整理由", "管理者状態", "役員状態", "操作", "ランク"];
    const lines = [
      headers.join(","),
      ...visibleRows.map((row) => {
        const autoRaiseAmount = row.finalSalaryReference - row.currentSalary;
        const adjustmentAmount = row.newSalary - row.finalSalaryReference;
        return [
          defaults.periodName,
          row.employeeName,
          row.teamName,
          row.currentSalary,
          row.overallGradeName,
          autoRaiseAmount,
          row.proposedRaiseAmount,
          adjustmentAmount,
          row.adjustmentReason,
          getManagerState(row),
          getExecutiveState(row.status),
          getRowActionLabel(row, canEdit, canApprove, canApply),
          row.finalRating,
        ].map(escapeCsv).join(",");
      }),
    ];

    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `salary-decision-${defaults.evaluationPeriodId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function updateFinalRaiseAmount(userId: string, nextRaiseAmount: number) {
    setRows((current) =>
      current.map((item) => {
        if (item.userId !== userId) return item;
        const newSalary = item.currentSalary + nextRaiseAmount;
        const proposedRaiseRate = item.currentSalary === 0 ? 0 : round((nextRaiseAmount / item.currentSalary) * 100);
        return {
          ...item,
          newSalary,
          proposedRaiseAmount: nextRaiseAmount,
          proposedRaiseRate,
          isWithinRecommendedRange: proposedRaiseRate >= item.recommendedMinRaiseRate && proposedRaiseRate <= item.recommendedMaxRaiseRate,
        };
      }),
    );
  }

  function updateAdjustmentReason(userId: string, adjustmentReason: string) {
    setRows((current) => current.map((item) => (item.userId === userId ? { ...item, adjustmentReason } : item)));
  }

  const totalAutoRaise = useMemo(() => rows.reduce((sum, row) => sum + (row.finalSalaryReference - row.currentSalary), 0), [rows]);
  const totalFinalRaise = useMemo(() => rows.reduce((sum, row) => sum + row.proposedRaiseAmount, 0), [rows]);
  const unapprovedCount = useMemo(() => rows.filter((row) => row.status === "DRAFT").length, [rows]);
  const missingReasonCount = useMemo(
    () => rows.filter((row) => requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) && !row.adjustmentReason.trim()).length,
    [largeDiffThreshold, rows],
  );

  const visibleRows = rows.filter((row) => {
    const adjustmentAmount = Math.abs(row.newSalary - row.finalSalaryReference);
    const matchesLargeDiff = showOnlyLargeDiff ? adjustmentAmount >= largeDiffThreshold : true;
    const matchesMissingReason = showOnlyMissingReason ? requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) && !row.adjustmentReason.trim() : true;
    return matchesLargeDiff && matchesMissingReason;
  });

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">昇給決定</h2>
          <p className="mt-1 text-sm text-slate-500">管理者は最終昇給額と調整理由を入力し、役員は承認、承認後に社員コストへ反映します。</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象人数</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{rows.length} 名</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">自動算出総額</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrencyWithUnit(totalAutoRaise)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">最終昇給総額</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrencyWithUnit(totalFinalRaise)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">未承認 / 理由不足</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{unapprovedCount} / <span className="text-amber-700">{missingReasonCount}</span></p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyLargeDiff}
              onChange={(event) => setShowOnlyLargeDiff(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            調整額が大きい行のみ表示
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
            理由必須基準
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
          <table className="min-w-[1900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">チーム</th>
                <th className="px-4 py-3 font-medium">現在給与</th>
                <th className="px-4 py-3 font-medium">等級</th>
                <th className="px-4 py-3 font-medium">自動算出昇給額</th>
                <th className="px-4 py-3 font-medium">最終昇給額</th>
                <th className="px-4 py-3 font-medium">調整額</th>
                <th className="px-4 py-3 font-medium">調整理由</th>
                <th className="px-4 py-3 font-medium">管理者状態</th>
                <th className="px-4 py-3 font-medium">役員状態</th>
                <th className="px-4 py-3 font-medium">操作</th>
                <th className="px-4 py-3 font-medium">ランク</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const autoRaiseAmount = row.finalSalaryReference - row.currentSalary;
                const adjustmentAmount = row.newSalary - row.finalSalaryReference;
                const rowLocked = row.status !== "DRAFT";
                return (
                  <tr key={row.userId} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3 font-medium text-slate-950">{row.employeeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(row.currentSalary)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.overallGradeName}</td>
                    <td className={`px-4 py-3 font-semibold ${autoRaiseAmount === 0 ? "text-slate-700" : autoRaiseAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(autoRaiseAmount)}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={row.proposedRaiseAmount}
                        disabled={!canEdit || isPending || rowLocked}
                        onChange={(event) => updateFinalRaiseAmount(row.userId, toNumber(event.target.value))}
                        className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className={`px-4 py-3 font-semibold ${adjustmentAmount === 0 ? "text-slate-700" : adjustmentAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(adjustmentAmount)}</td>
                    <td className="px-4 py-3">
                      <textarea
                        value={row.adjustmentReason}
                        disabled={!canEdit || isPending || rowLocked}
                        onChange={(event) => updateAdjustmentReason(row.userId, event.target.value)}
                        placeholder={requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) ? "調整理由を入力" : "必要に応じて入力"}
                        className={`min-h-[72px] w-56 rounded-xl border px-3 py-2 text-sm disabled:bg-slate-100 ${requiresAdjustmentReason(row.newSalary, row.finalSalaryReference, largeDiffThreshold) && !row.adjustmentReason.trim() ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{getManagerState(row)}</td>
                    <td className="px-4 py-3 text-slate-700">{getExecutiveState(row.status)}</td>
                    <td className="px-4 py-3 text-slate-700">{getRowActionLabel(row, canEdit, canApprove, canApply)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.finalRating}</td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 ? (
                <tr className="border-t border-slate-200">
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">条件に一致する対象者がありません。</td>
                </tr>
              ) : null}
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
            {isPending ? "処理中..." : "管理者調整を保存"}
          </button>
        ) : null}
        {canApprove ? (
          <button type="button" onClick={handleApprove} disabled={isPending || rows.length === 0} className="rounded-full border border-slate-400 px-5 py-2 text-sm font-semibold text-slate-800 disabled:border-slate-200 disabled:text-slate-300">
            役員承認
          </button>
        ) : null}
        {canApply ? (
          <button type="button" onClick={handleApply} disabled={isPending || rows.every((row) => row.status !== "APPROVED")} className="rounded-full border border-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-700 disabled:border-slate-200 disabled:text-slate-300">
            社員コストへ反映
          </button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
