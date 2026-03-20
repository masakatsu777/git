"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatCurrencyWithUnit } from "@/lib/format/currency";
import type { DepartmentMonthlyOtherCostRow } from "@/lib/pl/department-monthly-other-cost-service";

type DepartmentOption = {
  departmentId: string;
  departmentName: string;
};

type EditableRow = {
  id: string;
  departmentId: string;
  amount: number;
  remarks: string;
};

type DepartmentMonthlyOtherCostEditorProps = {
  yearMonth: string;
  canEdit: boolean;
  defaults: DepartmentMonthlyOtherCostRow[];
  departmentOptions: DepartmentOption[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toEditableRows(defaults: DepartmentMonthlyOtherCostRow[]): EditableRow[] {
  return defaults.map((row) => ({
    id: row.id,
    departmentId: row.departmentId,
    amount: row.amount,
    remarks: row.remarks,
  }));
}

function createRow(departmentId = ""): EditableRow {
  return {
    id: `draft-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
    departmentId,
    amount: 0,
    remarks: "",
  };
}

function getPreviousYearMonth(yearMonth: string) {
  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return yearMonth;
  const date = new Date(year, month - 2, 1);
  const nextYear = date.getFullYear();
  const nextMonth = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

export function DepartmentMonthlyOtherCostEditor({ yearMonth, canEdit, defaults, departmentOptions }: DepartmentMonthlyOtherCostEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableRow[]>(() => toEditableRows(defaults));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  useEffect(() => {
    setRows(toEditableRows(defaults));
  }, [defaults]);

  function updateRow(id: string, key: keyof EditableRow, value: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      return {
        ...row,
        [key]: key === "amount" ? toNumber(value) : value,
      };
    }));
  }

  function addRow() {
    setRows((current) => [...current, createRow(departmentOptions[0]?.departmentId ?? "")]);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  async function handleCopyPreviousMonth() {
    setMessage(null);
    const previousYearMonth = getPreviousYearMonth(yearMonth);

    startSaving(async () => {
      const response = await fetch(`/api/department-monthly-other-costs?yearMonth=${previousYearMonth}`);
      const result = (await response.json()) as {
        message?: string;
        data?: { rows?: DepartmentMonthlyOtherCostRow[] };
      };

      if (!response.ok) {
        setMessage(result.message ?? "前月データの取得に失敗しました");
        return;
      }

      const copiedRows = toEditableRows(result.data?.rows ?? []).map((row) => ({
        ...row,
        id: createRow(row.departmentId).id,
      }));
      setRows(copiedRows);
      setMessage(copiedRows.length > 0 ? `${previousYearMonth} の内容をコピーしました` : `${previousYearMonth} にコピー元データがありません`);
    });
  }

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/department-monthly-other-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth,
          rows: rows.map((row) => ({
            departmentId: row.departmentId,
            amount: row.amount,
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

  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">部署別その他コスト</h2>
          <p className="mt-1 text-sm text-slate-500">部署ごとの月次その他コストを明細で管理します。粗利内訳一覧では合計値だけに反映されます。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={addRow} disabled={!canEdit || isPending} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">
          行を追加
        </button>
        <button type="button" onClick={handleCopyPreviousMonth} disabled={!canEdit || isPending} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">
          前月コピー
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">部署</th>
                <th className="px-4 py-3 font-medium">金額</th>
                <th className="px-4 py-3 font-medium">備考</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-3">
                    <select value={row.departmentId} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "departmentId", event.target.value)} className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="">部署を選択</option>
                      {departmentOptions.map((option) => (
                        <option key={option.departmentId} value={option.departmentId}>{option.departmentName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.amount} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "amount", event.target.value)} className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={row.remarks} disabled={!canEdit || isPending} onChange={(event) => updateRow(row.id, "remarks", event.target.value)} className="w-full min-w-[24rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="補足・メモ" />
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => removeRow(row.id)} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:bg-slate-100 disabled:text-slate-400">
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">明細がありません。行を追加して入力してください。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "その他コストを保存"}
        </button>
        <p className="text-sm text-slate-500">対象月合計: {formatCurrencyWithUnit(total)}</p>
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
