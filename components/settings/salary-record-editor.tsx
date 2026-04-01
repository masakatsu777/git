"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatCurrencyWithUnit, formatSignedCurrencyWithUnit } from "@/lib/format/currency";

import type { SalaryRecordEditorRow, SalaryRecordHistoryRow } from "@/lib/salary/salary-record-service";

type SalaryRecordEditorProps = {
  yearMonth: string;
  canEdit: boolean;
  defaults: SalaryRecordEditorRow[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function historyTotalOf(row: Pick<SalaryRecordHistoryRow, "baseSalary" | "allowance" | "socialInsurance" | "otherFixedCost">) {
  return row.baseSalary + row.allowance + row.socialInsurance + row.otherFixedCost;
}

export function SalaryRecordEditor({ yearMonth, canEdit, defaults }: SalaryRecordEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState(defaults);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  function updateHistoryRow(userId: string, historyId: string, key: keyof SalaryRecordHistoryRow, value: string) {
    setRows((current) => current.map((row) => {
      if (row.userId !== userId) return row;

      const history = row.history.map((historyRow) => {
        if (historyRow.id !== historyId) return historyRow;
        const nextHistoryRow = {
          ...historyRow,
          [key]: key === "effectiveFrom" ? value : toNumber(value),
        } as SalaryRecordHistoryRow;
        return {
          ...nextHistoryRow,
          total: historyTotalOf(nextHistoryRow),
        };
      });

      if (row.id !== historyId) {
        return { ...row, history };
      }

      const currentHistory = history.find((historyRow) => historyRow.id === historyId);
      if (!currentHistory) {
        return { ...row, history };
      }

      return {
        ...row,
        effectiveFrom: currentHistory.effectiveFrom,
        baseSalary: currentHistory.baseSalary,
        allowance: currentHistory.allowance,
        socialInsurance: currentHistory.socialInsurance,
        otherFixedCost: currentHistory.otherFixedCost,
        total: currentHistory.total,
        history,
      };
    }));
  }

  function removeHistoryRow(userId: string, historyId: string) {
    setRows((current) => current.map((row) => {
      if (row.userId !== userId) return row;
      return {
        ...row,
        history: row.history.filter((historyRow) => historyRow.id !== historyId),
      };
    }));
    if (!historyId.startsWith("draft-")) {
      setDeletedIds((current) => Array.from(new Set([...current, historyId])));
    }
  }

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/salary-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth,
          rows: rows.map((row) => {
            const currentHistory = row.history.find((historyRow) => historyRow.id === row.id) ?? row.history[0];
            return {
              id: currentHistory?.id ?? row.id,
              userId: row.userId,
              effectiveFrom: currentHistory?.effectiveFrom ?? row.effectiveFrom,
              baseSalary: currentHistory?.baseSalary ?? row.baseSalary,
              allowance: currentHistory?.allowance ?? row.allowance,
              socialInsurance: currentHistory?.socialInsurance ?? row.socialInsurance,
              otherFixedCost: currentHistory?.otherFixedCost ?? row.otherFixedCost,
            };
          }),
          historyRows: rows.flatMap((row) => row.history.map((historyRow) => ({
            id: historyRow.id,
            userId: row.userId,
            effectiveFrom: historyRow.effectiveFrom,
            baseSalary: historyRow.baseSalary,
            allowance: historyRow.allowance,
            socialInsurance: historyRow.socialInsurance,
            otherFixedCost: historyRow.otherFixedCost,
          }))),
          deletedIds,
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));

      if (response.ok) {
        setDeletedIds([]);
        router.refresh();
      }
    });
  }

  const total = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">社員コスト</h2>
          <p className="mt-1 text-sm text-slate-500">月末時点で有効な給与・手当・社保・その他固定費を登録します。月次PLの人件費はここから自動集計されます。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">社員コード</th>
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">所属チーム</th>
                <th className="px-4 py-3 font-medium">適用開始日</th>
                <th className="px-4 py-3 font-medium">基本給</th>
                <th className="px-4 py-3 font-medium">手当</th>
                <th className="px-4 py-3 font-medium">社保</th>
                <th className="px-4 py-3 font-medium">その他固定費</th>
                <th className="px-4 py-3 font-medium">月次人件費</th>
                <th className="px-4 py-3 font-medium">履歴</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const expanded = expandedUserId === row.userId;
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-4 py-3 font-medium text-slate-950">{row.employeeCode}</td>
                      <td className="px-4 py-3 text-slate-700">{row.employeeName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.effectiveFrom}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(row.baseSalary)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(row.allowance)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(row.socialInsurance)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(row.otherFixedCost)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-950">{formatCurrencyWithUnit(row.total)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedUserId(expanded ? null : row.userId)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          {expanded ? "履歴を閉じる" : `履歴を見る${row.history.length > 0 ? ` (${row.history.length})` : ""}`}
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td colSpan={10} className="px-4 py-4">
                          {row.history.length > 0 ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                              <div className="overflow-x-auto">
                                <table className="min-w-[980px] text-left text-xs sm:text-sm">
                                  <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">適用開始日</th>
                                      <th className="px-3 py-2 font-medium">基本給</th>
                                      <th className="px-3 py-2 font-medium">手当</th>
                                      <th className="px-3 py-2 font-medium">社保</th>
                                      <th className="px-3 py-2 font-medium">その他固定費</th>
                                      <th className="px-3 py-2 font-medium">合計</th>
                                      <th className="px-3 py-2 font-medium">前回差額</th>
                                      <th className="px-3 py-2 font-medium">操作</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.history.map((historyRow) => {
                                      const isCurrentHistory = historyRow.id === row.id;
                                      return (
                                        <tr key={historyRow.id} className="border-t border-slate-100">
                                          <td className="px-3 py-2 text-slate-700">
                                            <input
                                              type="date"
                                              value={historyRow.effectiveFrom}
                                              disabled={!canEdit || isPending}
                                              onChange={(event) => updateHistoryRow(row.userId, historyRow.id, "effectiveFrom", event.target.value)}
                                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                            />
                                          </td>
                                          <td className="px-3 py-2 text-slate-700">
                                            <input type="number" value={historyRow.baseSalary} disabled={!canEdit || isPending} onChange={(event) => updateHistoryRow(row.userId, historyRow.id, "baseSalary", event.target.value)} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                          </td>
                                          <td className="px-3 py-2 text-slate-700">
                                            <input type="number" value={historyRow.allowance} disabled={!canEdit || isPending} onChange={(event) => updateHistoryRow(row.userId, historyRow.id, "allowance", event.target.value)} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                          </td>
                                          <td className="px-3 py-2 text-slate-700">
                                            <input type="number" value={historyRow.socialInsurance} disabled={!canEdit || isPending} onChange={(event) => updateHistoryRow(row.userId, historyRow.id, "socialInsurance", event.target.value)} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                          </td>
                                          <td className="px-3 py-2 text-slate-700">
                                            <input type="number" value={historyRow.otherFixedCost} disabled={!canEdit || isPending} onChange={(event) => updateHistoryRow(row.userId, historyRow.id, "otherFixedCost", event.target.value)} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                          </td>
                                          <td className="px-3 py-2 font-semibold text-slate-950">{formatCurrencyWithUnit(historyRow.total)}</td>
                                          <td className={`px-3 py-2 font-semibold ${historyRow.diffFromPrevious === null || historyRow.diffFromPrevious === 0 ? "text-slate-500" : historyRow.diffFromPrevious > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                            {historyRow.diffFromPrevious === null ? "-" : formatSignedCurrencyWithUnit(historyRow.diffFromPrevious)}
                                          </td>
                                          <td className="px-3 py-2">
                                            {canEdit && !isCurrentHistory ? (
                                              <button
                                                type="button"
                                                onClick={() => removeHistoryRow(row.userId, historyRow.id)}
                                                disabled={isPending}
                                                className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600"
                                              >
                                                削除
                                              </button>
                                            ) : (
                                              <span className="text-xs text-slate-400">{isCurrentHistory ? "現在値" : "-"}</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">履歴はまだありません。</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "社員コストを保存"}
        </button>
        <p className="text-sm text-slate-500">対象月の人件費合計: {formatCurrencyWithUnit(total)}</p>
        {canEdit ? <p className="text-sm text-slate-500">変更や削除は履歴一覧で行います。上段は対象月時点の現在値表示です。</p> : null}
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
