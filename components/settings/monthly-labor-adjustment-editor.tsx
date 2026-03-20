"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatCurrencyWithUnit } from "@/lib/format/currency";

import type { MonthlyLaborAdjustmentEditorRow } from "@/lib/salary/monthly-labor-adjustment-service";

type MonthlyLaborAdjustmentEditorProps = {
  yearMonth: string;
  canEdit: boolean;
  defaults: MonthlyLaborAdjustmentEditorRow[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function totalOf(row: Pick<MonthlyLaborAdjustmentEditorRow, "overtimeAmount" | "otherAmount">) {
  return row.overtimeAmount + row.otherAmount;
}

export function MonthlyLaborAdjustmentEditor({ yearMonth, canEdit, defaults }: MonthlyLaborAdjustmentEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState(defaults);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  function updateRow(id: string, key: keyof MonthlyLaborAdjustmentEditorRow, value: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;

      const next = {
        ...row,
        [key]: key === "remarks" ? value : toNumber(value),
      } as MonthlyLaborAdjustmentEditorRow;

      return {
        ...next,
        total: totalOf(next),
      };
    }));
  }

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/monthly-labor-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth,
          rows: rows.map((row) => ({
            id: row.id,
            userId: row.userId,
            overtimeAmount: row.overtimeAmount,
            otherAmount: row.otherAmount,
            remarks: row.remarks,
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

  const total = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">月次変動人件費</h2>
          <p className="mt-1 text-sm text-slate-500">残業代や月ごとの一時支給など、変動する人件費を年月単位で登録します。月次PLの人件費へ自動加算されます。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">社員コード</th>
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">所属チーム</th>
                <th className="px-4 py-3 font-medium">残業代</th>
                <th className="px-4 py-3 font-medium">その他</th>
                <th className="px-4 py-3 font-medium">備考</th>
                <th className="px-4 py-3 font-medium">月次追加額</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-3 font-medium text-slate-950">{row.employeeCode}</td>
                  <td className="px-4 py-3 text-slate-700">{row.employeeName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.overtimeAmount} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "overtimeAmount", event.target.value)} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.otherAmount} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "otherAmount", event.target.value)} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={row.remarks} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "remarks", event.target.value)} className="w-72 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="残業理由・一時支給の内容など" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{formatCurrencyWithUnit(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "月次変動人件費を保存"}
        </button>
        <p className="text-sm text-slate-500">対象月の追加人件費合計: {formatCurrencyWithUnit(total)}</p>
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
