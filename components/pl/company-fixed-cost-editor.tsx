"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FixedCostRow = {
  id: string;
  category: string;
  amount: number;
};

type CompanyFixedCostEditorProps = {
  yearMonth: string;
  canEdit: boolean;
  defaults: FixedCostRow[];
};

function uid() {
  return `fixed-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CompanyFixedCostEditor({ yearMonth, canEdit, defaults }: CompanyFixedCostEditorProps) {
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
        body: JSON.stringify({ yearMonth, rows }),
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
          <p className="mt-1 text-sm text-slate-500">家賃光熱費などの固定費を全社で入力し、月次PLでは社員人数比で各チームに按分します。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_180px_120px]">
            <input type="text" value={row.category} disabled={!canEdit || isPending} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, category: event.target.value } : item))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="費目" />
            <input type="number" value={row.amount} disabled={!canEdit || isPending} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, amount: toNumber(event.target.value) } : item))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="金額" />
            <button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 px-3 py-2 text-xs text-rose-600">削除</button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => setRows((current) => [...current, { id: uid(), category: "", amount: 0 }])} disabled={!canEdit || isPending} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          行追加
        </button>
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "固定費を保存"}
        </button>
      </div>

      <p className="mt-4 text-sm text-slate-500">全社固定費合計: {total.toLocaleString("ja-JP")} 円 / 配賦方式: 社員人数比</p>
      {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}