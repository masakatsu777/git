"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatCurrencyWithUnit } from "@/lib/format/currency";

import type { SalaryRecordEditorRow } from "@/lib/salary/salary-record-service";

type SalaryRecordEditorProps = {
  yearMonth: string;
  canEdit: boolean;
  defaults: SalaryRecordEditorRow[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function totalOf(row: Pick<SalaryRecordEditorRow, "baseSalary" | "allowance" | "socialInsurance" | "otherFixedCost">) {
  return row.baseSalary + row.allowance + row.socialInsurance + row.otherFixedCost;
}

export function SalaryRecordEditor({ yearMonth, canEdit, defaults }: SalaryRecordEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState(defaults);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  function updateRow(id: string, key: keyof SalaryRecordEditorRow, value: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;

      const next = {
        ...row,
        [key]: key === "effectiveFrom" ? value : toNumber(value),
      } as SalaryRecordEditorRow;

      return {
        ...next,
        total: totalOf(next),
      };
    }));
  }

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/salary-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth,
          rows: rows.map((row) => ({
            id: row.id,
            userId: row.userId,
            effectiveFrom: row.effectiveFrom,
            baseSalary: row.baseSalary,
            allowance: row.allowance,
            socialInsurance: row.socialInsurance,
            otherFixedCost: row.otherFixedCost,
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
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-3 font-medium text-slate-950">{row.employeeCode}</td>
                  <td className="px-4 py-3 text-slate-700">{row.employeeName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={row.effectiveFrom}
                      disabled={!canEdit || isPending}
                      onChange={(event) => updateRow(row.id, "effectiveFrom", event.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.baseSalary} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "baseSalary", event.target.value)} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.allowance} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "allowance", event.target.value)} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.socialInsurance} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "socialInsurance", event.target.value)} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.otherFixedCost} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "otherFixedCost", event.target.value)} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
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
          {isPending ? "処理中..." : "社員コストを保存"}
        </button>
        <p className="text-sm text-slate-500">対象月の人件費合計: {formatCurrencyWithUnit(total)}</p>
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}

