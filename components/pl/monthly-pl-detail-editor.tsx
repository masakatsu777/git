"use client";

import { startTransition, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatCurrencyWithUnit } from "@/lib/format/currency";

type Option = {
  id: string;
  label: string;
  defaultUnitPrice: number;
  defaultWorkRate: number;
  defaultOutsourceAmount?: number;
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

type OutsourcingRow = {
  id: string;
  partnerId: string | null;
  partnerName: string;
  amount: number;
  remarks: string;
};

type TeamExpenseRow = {
  id: string;
  category: string;
  amount: number;
  remarks: string;
};

type FixedCostSummary = {
  totalCompanyFixedCost: number;
  totalHeadcount: number;
  teamHeadcount: number;
  allocations: Array<{
    id: string;
    category: string;
    companyAmount: number;
    allocatedAmount: number;
    allocationMethod: "HEADCOUNT";
  }>;
};

type DetailEditorProps = {
  teamId: string;
  yearMonth: string;
  canEdit: boolean;
  employeeOptions: Option[];
  partnerOptions: Option[];
  fixedCostSummary: FixedCostSummary;
  defaults: {
    assignments: AssignmentRow[];
    outsourcingCosts: OutsourcingRow[];
    teamExpenses: TeamExpenseRow[];
  };
  targetSummary: {
    grossProfitRateTarget: number;
    grossProfitTarget: number;
  };
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSelectedOption(targetType: "EMPLOYEE" | "PARTNER", employeeOptions: Option[], partnerOptions: Option[]) {
  return targetType === "EMPLOYEE" ? employeeOptions[0] : partnerOptions[0];
}

function findPartnerOptionByName(partnerOptions: Option[], name: string) {
  const normalized = name.trim();
  return partnerOptions.find((item) => item.label === normalized);
}

export function MonthlyPlDetailEditor({
  teamId,
  yearMonth,
  canEdit,
  employeeOptions,
  partnerOptions,
  fixedCostSummary,
  defaults,
  targetSummary,
}: DetailEditorProps) {
  const router = useRouter();
  const [isPending, startSaving] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [assignments, setAssignments] = useState(defaults.assignments);
  const [outsourcingCosts, setOutsourcingCosts] = useState(defaults.outsourcingCosts);
  const [teamExpenses, setTeamExpenses] = useState(defaults.teamExpenses);

  const assignmentSalesTotal = useMemo(() => assignments.reduce((total, row) => total + row.salesAmount, 0), [assignments]);
  const outsourcingTotal = useMemo(() => outsourcingCosts.reduce((total, row) => total + row.amount, 0), [outsourcingCosts]);
  const teamExpenseTotal = useMemo(() => teamExpenses.reduce((total, row) => total + row.amount, 0), [teamExpenses]);
  const fixedTotal = useMemo(() => fixedCostSummary.allocations.reduce((total, row) => total + row.allocatedAmount, 0), [fixedCostSummary.allocations]);

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/pl/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          yearMonth,
          assignments,
          outsourcingCosts,
          teamExpenses,
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    });
  }

  async function handleCopyPreviousMonth() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/pl/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copyPrevious",
          teamId,
          yearMonth,
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "前月データをコピーしました" : "前月データのコピーに失敗しました"));

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    });
  }

  function addAssignment() {
    const option = employeeOptions[0];
    setAssignments((current) => [
      ...current,
      {
        id: uid("assign"),
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

  function addOutsourcing() {
    const option = partnerOptions[0];
    setOutsourcingCosts((current) => [
      ...current,
      {
        id: uid("out"),
        partnerId: option?.id ?? null,
        partnerName: option?.label ?? "",
        amount: option?.defaultOutsourceAmount ?? 0,
        remarks: "",
      },
    ]);
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">売上・費用明細入力</h2>
          <p className="mt-1 text-sm text-stone-500">固定費は全社入力を人数比で按分し、この画面では採用教育費とその他経費をチーム単位で入力します。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? (
            <button
              type="button"
              onClick={handleCopyPreviousMonth}
              disabled={isPending}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            >
              {isPending ? "処理中..." : "前月コピー"}
            </button>
          ) : null}
          {!canEdit ? <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-500">閲覧専用</span> : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-stone-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">売上単価入力</h3>
              <p className="mt-1 text-xs text-stone-500">社員・パートナー選択時に基準単価を初期反映します。</p>
            </div>
            <button type="button" onClick={addAssignment} disabled={!canEdit || isPending} className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium">行追加</button>
          </div>
          <div className="mt-4 space-y-3">
            {assignments.map((row) => (
              <div key={row.id} className="grid gap-3 rounded-2xl bg-stone-50 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={row.targetType}
                    disabled={!canEdit || isPending}
                    onChange={(event) => {
                      const nextType = event.target.value as "EMPLOYEE" | "PARTNER";
                      const option = getSelectedOption(nextType, employeeOptions, partnerOptions);
                      setAssignments((current) => current.map((item) => item.id === row.id ? {
                        ...item,
                        targetType: nextType,
                        userId: nextType === "EMPLOYEE" ? option?.id ?? null : null,
                        partnerId: nextType === "PARTNER" ? option?.id ?? null : null,
                        partnerName: nextType === "PARTNER" ? option?.label ?? "" : "",
                        unitPrice: option?.defaultUnitPrice ?? 0,
                        salesAmount: option?.defaultUnitPrice ?? 0,
                        workRate: option?.defaultWorkRate ?? 100,
                      } : item));
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
                    <input
                      type="text"
                      list="monthly-pl-partner-options"
                      value={row.partnerName}
                      disabled={!canEdit || isPending}
                      onChange={(event) => {
                        const partnerName = event.target.value;
                        const option = findPartnerOptionByName(partnerOptions, partnerName);
                        setAssignments((current) => current.map((item) => item.id === row.id ? {
                          ...item,
                          partnerName,
                          partnerId: option?.id ?? null,
                          unitPrice: option?.defaultUnitPrice ?? item.unitPrice,
                          salesAmount: option?.defaultUnitPrice ?? item.salesAmount,
                          workRate: option?.defaultWorkRate ?? item.workRate,
                        } : item));
                      }}
                      className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm"
                      placeholder="パートナー名"
                    />
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs text-stone-500">
                    単価
                    <input type="number" value={row.unitPrice} disabled={!canEdit || isPending} onChange={(event) => setAssignments((current) => current.map((item) => item.id === row.id ? { ...item, unitPrice: toNumber(event.target.value) } : item))} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" placeholder="単価" />
                  </label>
                  <label className="text-xs text-stone-500">
                    売上額
                    <input type="number" value={row.salesAmount} disabled={!canEdit || isPending} onChange={(event) => setAssignments((current) => current.map((item) => item.id === row.id ? { ...item, salesAmount: toNumber(event.target.value) } : item))} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" placeholder="売上" />
                  </label>
                  <label className="text-xs text-stone-500">
                    稼働率
                    <input type="number" value={row.workRate} disabled={!canEdit || isPending} onChange={(event) => setAssignments((current) => current.map((item) => item.id === row.id ? { ...item, workRate: toNumber(event.target.value) } : item))} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" placeholder="稼働率" />
                  </label>
                </div>
                <div className="flex gap-3">
                  <input type="text" value={row.remarks} disabled={!canEdit || isPending} onChange={(event) => setAssignments((current) => current.map((item) => item.id === row.id ? { ...item, remarks: event.target.value } : item))} className="flex-1 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm" placeholder="備考特記" />
                  <button type="button" onClick={() => setAssignments((current) => current.filter((item) => item.id !== row.id))} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 px-3 py-2 text-xs text-rose-600 sm:col-span-2 sm:justify-self-end">削除</button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-stone-500">売上合計: {formatCurrencyWithUnit(assignmentSalesTotal)}</p>
        </section>

        <section className="rounded-3xl border border-stone-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">外注費入力</h3>
              <p className="mt-1 text-xs text-stone-500">パートナー選択時に標準外注費を初期反映します。売上がない月でも、外注費のみ入力できます。</p>
            </div>
            <button type="button" onClick={addOutsourcing} disabled={!canEdit || isPending} className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium">行追加</button>
          </div>
          <div className="mt-4 space-y-3">
            {outsourcingCosts.map((row) => (
              <div key={row.id} className="grid gap-3 rounded-2xl bg-stone-50 p-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <input
                  type="text"
                  list="monthly-pl-partner-options"
                  value={row.partnerName}
                  disabled={!canEdit || isPending}
                  onChange={(event) => {
                    const partnerName = event.target.value;
                    const option = findPartnerOptionByName(partnerOptions, partnerName);
                    setOutsourcingCosts((current) => current.map((item) => item.id === row.id ? {
                      ...item,
                      partnerName,
                      partnerId: option?.id ?? null,
                      amount: option?.defaultOutsourceAmount ?? item.amount,
                    } : item));
                  }}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="パートナー名"
                />
                <input type="number" value={row.amount} disabled={!canEdit || isPending} onChange={(event) => setOutsourcingCosts((current) => current.map((item) => item.id === row.id ? { ...item, amount: toNumber(event.target.value) } : item))} className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm" placeholder="金額" />
                <button type="button" onClick={() => setOutsourcingCosts((current) => current.filter((item) => item.id !== row.id))} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 px-3 py-2 text-xs text-rose-600 sm:col-span-2 sm:justify-self-end">削除</button>
                <input type="text" value={row.remarks} disabled={!canEdit || isPending} onChange={(event) => setOutsourcingCosts((current) => current.map((item) => item.id === row.id ? { ...item, remarks: event.target.value } : item))} className="sm:col-span-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm" placeholder="所属" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-stone-500">外注費合計: {formatCurrencyWithUnit(outsourcingTotal)}</p>
        </section>

        <section className="rounded-3xl border border-stone-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">チーム経費入力</h3>
            <button type="button" onClick={() => setTeamExpenses((current) => [...current, { id: uid("expense"), category: "採用教育費", amount: 0, remarks: "" }])} disabled={!canEdit || isPending} className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium">行追加</button>
          </div>
          <div className="mt-4 space-y-3">
            {teamExpenses.map((row) => (
              <div key={row.id} className="grid gap-3 rounded-2xl bg-stone-50 p-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <select value={row.category} disabled={!canEdit || isPending} onChange={(event) => setTeamExpenses((current) => current.map((item) => item.id === row.id ? { ...item, category: event.target.value } : item))} className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm">
                  <option value="採用教育費">採用教育費</option>
                  <option value="その他経費">その他経費</option>
                </select>
                <input type="number" value={row.amount} disabled={!canEdit || isPending} onChange={(event) => setTeamExpenses((current) => current.map((item) => item.id === row.id ? { ...item, amount: toNumber(event.target.value) } : item))} className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm" placeholder="金額" />
                <button type="button" onClick={() => setTeamExpenses((current) => current.filter((item) => item.id !== row.id))} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 px-3 py-2 text-xs text-rose-600">削除</button>
                <input type="text" value={row.remarks} disabled={!canEdit || isPending} onChange={(event) => setTeamExpenses((current) => current.map((item) => item.id === row.id ? { ...item, remarks: event.target.value } : item))} className="sm:col-span-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm" placeholder="所属" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-stone-500">チーム経費合計: {formatCurrencyWithUnit(teamExpenseTotal)}</p>
        </section>

        <section className="rounded-3xl border border-stone-200 p-4">
          <h3 className="font-semibold">全社固定費按分</h3>
          <p className="mt-1 text-sm text-stone-500">全社入力された固定費を、社員人数比で自動按分しています。</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[72px_64px_minmax(0,1fr)]">
            <div className="min-w-0 rounded-2xl bg-stone-50 px-3 py-4">
              <p className="text-xs text-stone-500">社員数</p>
              <p className="mt-2 text-sm font-semibold sm:text-base">{fixedCostSummary.totalHeadcount} 名</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-stone-50 px-3 py-4">
              <p className="text-xs text-stone-500">チーム</p>
              <p className="mt-2 text-sm font-semibold sm:text-base">{fixedCostSummary.teamHeadcount} 名</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-stone-50 px-3 py-4">
              <p className="text-xs text-stone-500">按分額</p>
              <p className="mt-2 text-sm font-semibold sm:text-[15px]">{formatCurrencyWithUnit(fixedTotal)}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {fixedCostSummary.allocations.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-stone-800">{row.category}</p>
                  <p className="text-stone-500">全社 {formatCurrencyWithUnit(row.companyAmount)} / 人数比按分</p>
                </div>
                <p className="font-semibold text-stone-950">{formatCurrencyWithUnit(row.allocatedAmount)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-stone-200 p-4">
        <h3 className="font-semibold">粗利目標</h3>
        <p className="mt-1 text-sm text-stone-500">目標粗利率はトップ経営ダッシュボードで設定します。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-sm font-medium text-stone-600">目標粗利率</p>
            <p className="mt-2 text-xl font-semibold text-stone-950">{targetSummary.grossProfitRateTarget}%</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-sm font-medium text-stone-600">目標粗利額</p>
            <p className="mt-2 text-xl font-semibold text-stone-950">{formatCurrencyWithUnit(targetSummary.grossProfitTarget)}</p>
          </div>
        </div>
      </section>

      <datalist id="monthly-pl-partner-options">
        {partnerOptions.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300">
          {isPending ? "処理中..." : "明細を保存する"}
        </button>
      </div>

      {message ? <p className="text-sm text-stone-600">{message}</p> : null}
    </section>
  );
}
