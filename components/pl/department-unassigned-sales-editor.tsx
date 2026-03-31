"use client";

import { startTransition, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatCurrencyWithUnit } from "@/lib/format/currency";

type Option = {
  id: string;
  label: string;
  defaultUnitPrice: number;
  defaultWorkRate: number;
};

type AssignmentRow = {
  id: string;
  targetType: "EMPLOYEE" | "PARTNER";
  userId: string | null;
  partnerId: string | null;
  partnerName: string;
  unitPrice: number;
  salesAmount: number;
  workRate: number;
  remarks: string;
};

type Props = {
  departmentId: string;
  yearMonth: string;
  canEdit: boolean;
  employeeOptions: Option[];
  partnerOptions: Option[];
  defaults: AssignmentRow[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DepartmentUnassignedSalesEditor({ departmentId, yearMonth, canEdit, employeeOptions, partnerOptions, defaults }: Props) {
  const router = useRouter();
  const [isPending, startSaving] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [assignments, setAssignments] = useState(defaults);

  const salesTotal = useMemo(() => assignments.reduce((total, row) => total + row.salesAmount, 0), [assignments]);

  function addEmployeeAssignment() {
    const option = employeeOptions[0];
    setAssignments((current) => [
      ...current,
      {
        id: uid("dept-unassigned-employee"),
        targetType: "EMPLOYEE",
        userId: option?.id ?? null,
        partnerId: null,
        partnerName: "",
        unitPrice: option?.defaultUnitPrice ?? 0,
        salesAmount: option?.defaultUnitPrice ?? 0,
        workRate: option?.defaultWorkRate ?? 100,
        remarks: "",
      },
    ]);
  }

  function addPartnerAssignment() {
    const option = partnerOptions[0];
    setAssignments((current) => [
      ...current,
      {
        id: uid("dept-unassigned-partner"),
        targetType: "PARTNER",
        userId: null,
        partnerId: option?.id ?? null,
        partnerName: option?.label ?? "",
        unitPrice: option?.defaultUnitPrice ?? 0,
        salesAmount: option?.defaultUnitPrice ?? 0,
        workRate: option?.defaultWorkRate ?? 100,
        remarks: "",
      },
    ]);
  }

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/pl/unassigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          yearMonth,
          assignments,
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "未所属売上を保存しました" : "未所属売上の保存に失敗しました"));

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    });
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">部署未所属売上入力</h2>
          <p className="mt-1 text-sm text-stone-500">チーム未所属の社員・未所属パートナーの売上を部署単位で登録します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addEmployeeAssignment} disabled={!canEdit || isPending || employeeOptions.length === 0} className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium">
            社員行追加
          </button>
          <button type="button" onClick={addPartnerAssignment} disabled={!canEdit || isPending || partnerOptions.length === 0} className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium">
            パートナー行追加
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {assignments.map((row) => (
          <div key={row.id} className="grid gap-3 rounded-2xl bg-stone-50 p-3">
            <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]">
              <select
                value={row.targetType}
                disabled={!canEdit || isPending}
                onChange={(event) => {
                  const nextType = event.target.value === "PARTNER" ? "PARTNER" : "EMPLOYEE";
                  if (nextType === "PARTNER") {
                    const option = partnerOptions[0];
                    setAssignments((current) => current.map((item) => item.id === row.id ? {
                      ...item,
                      targetType: "PARTNER",
                      userId: null,
                      partnerId: option?.id ?? null,
                      partnerName: option?.label ?? "",
                      unitPrice: option?.defaultUnitPrice ?? 0,
                      salesAmount: option?.defaultUnitPrice ?? 0,
                      workRate: option?.defaultWorkRate ?? 100,
                    } : item));
                  } else {
                    const option = employeeOptions[0];
                    setAssignments((current) => current.map((item) => item.id === row.id ? {
                      ...item,
                      targetType: "EMPLOYEE",
                      userId: option?.id ?? null,
                      partnerId: null,
                      partnerName: "",
                      unitPrice: option?.defaultUnitPrice ?? 0,
                      salesAmount: option?.defaultUnitPrice ?? 0,
                      workRate: option?.defaultWorkRate ?? 100,
                    } : item));
                  }
                }}
                className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm"
              >
                <option value="EMPLOYEE">社員</option>
                <option value="PARTNER">パートナー</option>
              </select>
              {row.targetType === "EMPLOYEE" ? (
                <select
                  value={row.userId ?? ""}
                  disabled={!canEdit || isPending}
                  onChange={(event) => {
                    const selectedId = event.target.value || null;
                    const option = employeeOptions.find((item) => item.id === selectedId);
                    setAssignments((current) => current.map((item) => item.id === row.id ? {
                      ...item,
                      userId: selectedId,
                      unitPrice: option?.defaultUnitPrice ?? item.unitPrice,
                      salesAmount: option?.defaultUnitPrice ?? item.salesAmount,
                      workRate: option?.defaultWorkRate ?? item.workRate,
                    } : item));
                  }}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm"
                >
                  {employeeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              ) : (
                <select
                  value={row.partnerId ?? ""}
                  disabled={!canEdit || isPending}
                  onChange={(event) => {
                    const selectedId = event.target.value || null;
                    const option = partnerOptions.find((item) => item.id === selectedId);
                    setAssignments((current) => current.map((item) => item.id === row.id ? {
                      ...item,
                      partnerId: selectedId,
                      partnerName: option?.label ?? "",
                      unitPrice: option?.defaultUnitPrice ?? item.unitPrice,
                      salesAmount: option?.defaultUnitPrice ?? item.salesAmount,
                      workRate: option?.defaultWorkRate ?? item.workRate,
                    } : item));
                  }}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm"
                >
                  {partnerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              )}
              <input
                type="text"
                value={row.remarks}
                disabled={!canEdit || isPending}
                onChange={(event) => setAssignments((current) => current.map((item) => item.id === row.id ? { ...item, remarks: event.target.value } : item))}
                className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm"
                placeholder="備考特記"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-stone-500">
                単価
                <input type="number" value={row.unitPrice} disabled={!canEdit || isPending} onChange={(event) => setAssignments((current) => current.map((item) => item.id === row.id ? { ...item, unitPrice: toNumber(event.target.value) } : item))} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" />
              </label>
              <label className="text-xs text-stone-500">
                売上額
                <input type="number" value={row.salesAmount} disabled={!canEdit || isPending} onChange={(event) => setAssignments((current) => current.map((item) => item.id === row.id ? { ...item, salesAmount: toNumber(event.target.value) } : item))} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" />
              </label>
              <label className="text-xs text-stone-500">
                稼働率
                <input type="number" value={row.workRate} disabled={!canEdit || isPending} onChange={(event) => setAssignments((current) => current.map((item) => item.id === row.id ? { ...item, workRate: toNumber(event.target.value) } : item))} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" />
              </label>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setAssignments((current) => current.filter((item) => item.id !== row.id))} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 px-3 py-2 text-xs text-rose-600">
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-stone-500">売上合計: {formatCurrencyWithUnit(salesTotal)}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300">
          {isPending ? "処理中..." : "未所属売上を保存する"}
        </button>
      </div>
      {message ? <p className="text-sm text-stone-600">{message}</p> : null}
    </section>
  );
}
