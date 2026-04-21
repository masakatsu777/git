"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  BudgetSimulationBundle,
  BudgetSimulationRow,
  BudgetSimulationSubjectSummary,
  BudgetSimulationWarningCode,
} from "@/lib/budget-simulations/budget-simulation-service";
import { formatCurrencyWithUnit, formatSignedCurrencyWithUnit } from "@/lib/format/currency";

type BudgetSimulationEditorProps = {
  canEdit: boolean;
  defaults: BudgetSimulationBundle;
};

type EditableRow = Pick<
  BudgetSimulationRow,
  "key" | "assumedUnitPrice" | "assumedDirectLaborCost" | "assumedOutsourcingCost" | "memo"
>;

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundRate(value: number) {
  return Math.round(value * 100) / 100;
}

function warningLabel(code: BudgetSimulationWarningCode) {
  switch (code) {
    case "BUDGET_OVER":
      return "予算超過";
    case "NEGATIVE_GROSS_PROFIT":
      return "粗利マイナス";
    case "BELOW_TARGET_RATE":
      return "目標粗利率未達";
    case "COST_OVER_SALES":
      return "原価超過";
    default:
      return code;
  }
}

function warningTone(codes: BudgetSimulationWarningCode[]) {
  if (codes.includes("NEGATIVE_GROSS_PROFIT") || codes.includes("BUDGET_OVER")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (codes.length > 0) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function buildWarningCodes(
  row: BudgetSimulationRow,
  assumedUnitPrice: number,
  assumedDirectLaborCost: number,
  assumedOutsourcingCost: number,
  budgetRemaining: number,
) {
  const assumedGrossProfit = assumedUnitPrice - assumedDirectLaborCost - assumedOutsourcingCost - row.indirectCostAllocation - row.fixedCostAllocation;
  const assumedGrossProfitRate = assumedUnitPrice === 0 ? 0 : roundRate((assumedGrossProfit / assumedUnitPrice) * 100);
  const warnings = new Set<BudgetSimulationWarningCode>();

  if (budgetRemaining < 0) warnings.add("BUDGET_OVER");
  if (assumedGrossProfit < 0) warnings.add("NEGATIVE_GROSS_PROFIT");
  if (assumedGrossProfitRate < row.targetGrossProfitRate) warnings.add("BELOW_TARGET_RATE");
  if (assumedUnitPrice < assumedDirectLaborCost + assumedOutsourcingCost + row.indirectCostAllocation + row.fixedCostAllocation) {
    warnings.add("COST_OVER_SALES");
  }

  return Array.from(warnings);
}

function rebuildRows(rows: BudgetSimulationRow[], budgetTotal: number) {
  const totalRaiseAmount = rows
    .filter((row) => row.subjectType === "EMPLOYEE")
    .reduce((sum, row) => sum + (row.assumedDirectLaborCost - row.currentDirectLaborCost), 0);
  const budgetRemaining = budgetTotal - totalRaiseAmount;

  return rows.map((row) => {
    const assumedGrossProfit =
      row.assumedUnitPrice -
      row.assumedDirectLaborCost -
      row.assumedOutsourcingCost -
      row.indirectCostAllocation -
      row.fixedCostAllocation;
    const assumedGrossProfitRate = row.assumedUnitPrice === 0 ? 0 : roundRate((assumedGrossProfit / row.assumedUnitPrice) * 100);

    return {
      ...row,
      assumedSalesAmount: row.assumedUnitPrice,
      assumedGrossProfit,
      assumedGrossProfitRate,
      warningCodes: buildWarningCodes(row, row.assumedUnitPrice, row.assumedDirectLaborCost, row.assumedOutsourcingCost, budgetRemaining),
    };
  });
}

function summarizeSubject(rows: BudgetSimulationRow[], subjectType: "EMPLOYEE" | "PARTNER"): BudgetSimulationSubjectSummary {
  const filtered = rows.filter((row) => row.subjectType === subjectType);
  return {
    count: filtered.length,
    salesTotal: filtered.reduce((sum, row) => sum + row.assumedSalesAmount, 0),
    directLaborCost: filtered.reduce((sum, row) => sum + row.assumedDirectLaborCost, 0),
    outsourcingCost: filtered.reduce((sum, row) => sum + row.assumedOutsourcingCost, 0),
    finalGrossProfit: filtered.reduce((sum, row) => sum + row.assumedGrossProfit, 0),
  };
}

export function BudgetSimulationEditor({ canEdit, defaults }: BudgetSimulationEditorProps) {
  const router = useRouter();
  const [budgetTotal, setBudgetTotal] = useState(defaults.budgetTotal);
  const [note, setNote] = useState(defaults.note);
  const [rows, setRows] = useState(defaults.rows);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => {
    const totalCurrentLaborCost = rows.reduce((sum, row) => sum + row.currentDirectLaborCost, 0);
    const totalAssumedLaborCost = rows.reduce((sum, row) => sum + row.assumedDirectLaborCost, 0);
    const totalCurrentOutsourcingCost = rows.reduce((sum, row) => sum + row.currentOutsourcingCost, 0);
    const totalAssumedOutsourcingCost = rows.reduce((sum, row) => sum + row.assumedOutsourcingCost, 0);
    const totalRaiseAmount = rows
      .filter((row) => row.subjectType === "EMPLOYEE")
      .reduce((sum, row) => sum + (row.assumedDirectLaborCost - row.currentDirectLaborCost), 0);
    const totalCurrentSalesAmount = rows.reduce((sum, row) => sum + row.currentSalesAmount, 0);
    const totalAssumedSalesAmount = rows.reduce((sum, row) => sum + row.assumedSalesAmount, 0);
    const totalIndirectCostAllocation = rows.reduce((sum, row) => sum + row.indirectCostAllocation, 0);
    const totalFixedCostAllocation = rows.reduce((sum, row) => sum + row.fixedCostAllocation, 0);
    const totalAssumedGrossProfit = rows.reduce((sum, row) => sum + row.assumedGrossProfit, 0);

    return {
      headcount: rows.length,
      totalCurrentLaborCost,
      totalAssumedLaborCost,
      totalCurrentOutsourcingCost,
      totalAssumedOutsourcingCost,
      totalRaiseAmount,
      budgetRemaining: budgetTotal - totalRaiseAmount,
      totalCurrentSalesAmount,
      totalAssumedSalesAmount,
      totalIndirectCostAllocation,
      totalFixedCostAllocation,
      totalAssumedGrossProfit,
      totalAssumedGrossProfitRate: totalAssumedSalesAmount === 0 ? 0 : roundRate((totalAssumedGrossProfit / totalAssumedSalesAmount) * 100),
      rowsWithWarnings: rows.filter((row) => row.warningCodes.length > 0).length,
      employeeSummary: summarizeSubject(rows, "EMPLOYEE"),
      partnerSummary: summarizeSubject(rows, "PARTNER"),
    };
  }, [budgetTotal, rows]);

  function updateBudget(value: number) {
    setBudgetTotal(value);
    setRows((current) => rebuildRows(current, value));
  }

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((current) =>
      rebuildRows(
        current.map((row) =>
          row.key === key
            ? {
                ...row,
                assumedUnitPrice: patch.assumedUnitPrice ?? row.assumedUnitPrice,
                assumedDirectLaborCost: patch.assumedDirectLaborCost ?? row.assumedDirectLaborCost,
                assumedOutsourcingCost: patch.assumedOutsourcingCost ?? row.assumedOutsourcingCost,
                memo: patch.memo ?? row.memo,
              }
            : row,
        ),
        budgetTotal,
      ),
    );
  }

  async function handleSave() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/budget-simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: defaults.yearMonth,
          budgetTotal,
          note,
          evaluationPeriodId: defaults.evaluationPeriodId,
          rows: rows.map((row) => ({
            key: row.key,
            assumedUnitPrice: row.assumedUnitPrice,
            assumedDirectLaborCost: row.assumedDirectLaborCost,
            assumedOutsourcingCost: row.assumedOutsourcingCost,
            memo: row.memo,
          })),
        }),
      });
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));
      if (response.ok) router.refresh();
    });
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">予算制約シミュレーション</h2>
          <p className="mt-1 text-sm text-slate-500">粗利内訳の表示対象に合わせて、社員は人件費、パートナーは外注費を仮置きしながら粗利見込を確認します。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[180px_220px_auto]">
          <label className="text-sm text-slate-700">
            昇給予算総額
            <input
              type="number"
              min="0"
              value={budgetTotal}
              disabled={!canEdit || isPending}
              onChange={(event) => updateBudget(toNumber(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none disabled:bg-slate-100"
            />
          </label>
          <label className="text-sm text-slate-700">
            メモ
            <input
              type="text"
              value={note}
              disabled={!canEdit || isPending}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none disabled:bg-slate-100"
              placeholder="単価改定あり案 など"
            />
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || isPending}
            className="h-[52px] self-end rounded-full bg-slate-950 px-5 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">対象件数</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{summary.headcount} 件</p>
        </article>
        <article className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">仮昇給総額</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrencyWithUnit(summary.totalRaiseAmount)}</p>
        </article>
        <article className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">予算残額</p>
          <p className={`mt-2 text-lg font-semibold ${summary.budgetRemaining < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatSignedCurrencyWithUnit(summary.budgetRemaining)}</p>
        </article>
        <article className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">仮設定後の粗利</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrencyWithUnit(summary.totalAssumedGrossProfit)}</p>
        </article>
        <article className="rounded-2xl bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-500">仮設定後の粗利率</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{summary.totalAssumedGrossProfitRate}%</p>
        </article>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">現在人件費総額</p>
            <p className="mt-1 font-semibold text-slate-950">{formatCurrencyWithUnit(summary.totalCurrentLaborCost)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">現在外注費総額</p>
            <p className="mt-1 font-semibold text-slate-950">{formatCurrencyWithUnit(summary.totalCurrentOutsourcingCost)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">警告あり</p>
            <p className="mt-1 font-semibold text-slate-950">{summary.rowsWithWarnings} 件</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">区分</th>
                <th className="px-4 py-3 font-medium">件数</th>
                <th className="px-4 py-3 font-medium">仮売上</th>
                <th className="px-4 py-3 font-medium">仮人件費</th>
                <th className="px-4 py-3 font-medium">仮外注費</th>
                <th className="px-4 py-3 font-medium">仮粗利</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "社員", summary: summary.employeeSummary },
                { label: "パートナー", summary: summary.partnerSummary },
              ].map((item) => {
                return (
                  <tr key={item.label} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-950">{item.label}</td>
                    <td className="px-4 py-3 text-slate-700">{item.summary.count} 件</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(item.summary.salesTotal)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(item.summary.directLaborCost)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(item.summary.outsourcingCost)}</td>
                    <td className={`px-4 py-3 font-semibold ${item.summary.finalGrossProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(item.summary.finalGrossProfit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[1980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="sticky left-0 z-20 w-24 border-r border-slate-200 bg-slate-50 px-3 py-3 font-medium">区分</th>
                <th className="sticky left-24 z-20 w-40 border-r border-slate-200 bg-slate-50 px-3 py-3 font-medium">名称</th>
                <th className="sticky left-64 z-20 w-36 border-r border-slate-200 bg-slate-50 px-3 py-3 font-medium">チーム</th>
                <th className="px-3 py-3 font-medium">社員No./所属</th>
                <th className="px-3 py-3 font-medium">部署</th>
                <th className="px-3 py-3 font-medium">現在売上</th>
                <th className="px-3 py-3 font-medium">仮売上</th>
                <th className="px-3 py-3 font-medium">現有人件費</th>
                <th className="px-3 py-3 font-medium">昇給後人件費</th>
                <th className="px-3 py-3 font-medium">現在外注費</th>
                <th className="px-3 py-3 font-medium">仮外注費</th>
                <th className="px-3 py-3 font-medium">チーム経費按分</th>
                <th className="px-3 py-3 font-medium">全社固定費按分</th>
                <th className="px-3 py-3 font-medium">仮粗利</th>
                <th className="px-3 py-3 font-medium">仮粗利率</th>
                <th className="px-3 py-3 font-medium">警告</th>
                <th className="px-3 py-3 font-medium">メモ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const laborDiff = row.assumedDirectLaborCost - row.currentDirectLaborCost;
                return (
                  <tr key={row.key} className="border-t border-slate-200 align-top">
                    <td className="sticky left-0 z-10 w-24 border-r border-slate-200 bg-white px-3 py-3 font-medium text-slate-950">{row.subjectType === "EMPLOYEE" ? "社員" : "パートナー"}</td>
                    <td className="sticky left-24 z-10 w-40 border-r border-slate-200 bg-white px-3 py-3 text-slate-900">{row.employeeName}</td>
                    <td className="sticky left-64 z-10 w-36 border-r border-slate-200 bg-white px-3 py-3 text-slate-700">{row.teamName || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{row.secondaryLabel || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{row.departmentName || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{formatCurrencyWithUnit(row.currentSalesAmount)}</td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        value={row.assumedUnitPrice}
                        disabled={!canEdit || isPending}
                        onChange={(event) => updateRow(row.key, { assumedUnitPrice: toNumber(event.target.value) })}
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3 text-slate-700">{formatCurrencyWithUnit(row.currentDirectLaborCost)}</td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        value={row.assumedDirectLaborCost}
                        disabled={!canEdit || isPending || row.subjectType === "PARTNER"}
                        onChange={(event) => updateRow(row.key, { assumedDirectLaborCost: toNumber(event.target.value) })}
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 disabled:bg-slate-100"
                      />
                      {row.subjectType === "EMPLOYEE" ? (
                        <p className={`mt-1 text-xs font-semibold ${laborDiff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(laborDiff)}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{formatCurrencyWithUnit(row.currentOutsourcingCost)}</td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        value={row.assumedOutsourcingCost}
                        disabled={!canEdit || isPending || row.subjectType === "EMPLOYEE"}
                        onChange={(event) => updateRow(row.key, { assumedOutsourcingCost: toNumber(event.target.value) })}
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3 text-slate-700">{formatCurrencyWithUnit(row.indirectCostAllocation)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatCurrencyWithUnit(row.fixedCostAllocation)}</td>
                    <td className={`px-3 py-3 font-semibold ${row.assumedGrossProfit >= 0 ? "text-slate-950" : "text-rose-700"}`}>{formatSignedCurrencyWithUnit(row.assumedGrossProfit)}</td>
                    <td className={`px-3 py-3 font-semibold ${row.assumedGrossProfitRate >= row.targetGrossProfitRate ? "text-emerald-700" : "text-amber-700"}`}>{row.assumedGrossProfitRate}%</td>
                    <td className="px-3 py-3">
                      <div className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${warningTone(row.warningCodes)}`}>
                        {row.warningCodes.length === 0 ? "良好" : row.warningCodes.map(warningLabel).join(" / ")}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={row.memo}
                        disabled={!canEdit || isPending}
                        onChange={(event) => updateRow(row.key, { memo: event.target.value })}
                        className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 disabled:bg-slate-100"
                        placeholder="理由や前提を記入"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
