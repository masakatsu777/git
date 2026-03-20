"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatCurrencyWithUnit } from "@/lib/format/currency";
import type { CompanyFixedCostRow } from "@/lib/pl/fixed-cost-service";

type DepartmentOption = {
  departmentId: string;
  departmentName: string;
};

type CompanyFixedCostEditorProps = {
  canEdit: boolean;
  defaults: CompanyFixedCostRow[];
  departmentOptions: DepartmentOption[];
};

function uid() {
  return `fixed-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CompanyFixedCostEditor({ canEdit, defaults, departmentOptions }: CompanyFixedCostEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState(defaults);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/pl/fixed-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">全社固定費設定</h2>
          <p className="mt-1 text-sm text-slate-500">適用開始年月ごとに全社額を入力し、部署ごとの配賦額へ振り分けます。月次PLでは所属部署の配賦額を同部署人数で按分します。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((row) => {
          const allocationTotal = row.departmentAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
          const difference = row.amount - allocationTotal;

          return (
            <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-[150px_1fr_180px_120px]">
                <input type="month" value={row.effectiveYearMonth} disabled={!canEdit || isPending} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, effectiveYearMonth: event.target.value } : item))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <input type="text" value={row.category} disabled={!canEdit || isPending} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, category: event.target.value } : item))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="例: 共通管理費" />
                <input type="number" value={row.amount} disabled={!canEdit || isPending} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, amount: toNumber(event.target.value) } : item))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="全社固定費総額" />
                <button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 px-3 py-2 text-xs text-rose-600">削除</button>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">部署配賦</h3>
                  <p className={`text-xs font-medium ${difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                    部署配賦合計 {formatCurrencyWithUnit(allocationTotal)} / 差額 {formatCurrencyWithUnit(difference)}
                  </p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {departmentOptions.map((department) => {
                    const allocation = row.departmentAllocations.find((item) => item.departmentId === department.departmentId);
                    return (
                      <label key={department.departmentId} className="text-sm text-slate-700">
                        {department.departmentName}
                        <input
                          type="number"
                          value={allocation?.amount ?? 0}
                          disabled={!canEdit || isPending}
                          onChange={(event) => {
                            const amount = toNumber(event.target.value);
                            setRows((current) => current.map((item) => item.id === row.id ? {
                              ...item,
                              departmentAllocations: departmentOptions.map((option) => option.departmentId === department.departmentId
                                ? { departmentId: option.departmentId, departmentName: option.departmentName, amount }
                                : item.departmentAllocations.find((currentAllocation) => currentAllocation.departmentId === option.departmentId) ?? { departmentId: option.departmentId, departmentName: option.departmentName, amount: 0 }),
                            } : item));
                          }}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, {
            id: uid(),
            effectiveYearMonth: "",
            category: "全社固定費",
            amount: 0,
            allocationMethod: "HEADCOUNT",
            departmentAllocations: departmentOptions.map((department) => ({
              departmentId: department.departmentId,
              departmentName: department.departmentName,
              amount: 0,
            })),
          }])}
          disabled={!canEdit || isPending}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          行追加
        </button>
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "固定費を保存"}
        </button>
      </div>

      <p className="mt-4 text-sm text-slate-500">設定中の全社固定費総額: {formatCurrencyWithUnit(total)} / 按分方式: 部署配賦額を同部署人数で按分</p>
      {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
