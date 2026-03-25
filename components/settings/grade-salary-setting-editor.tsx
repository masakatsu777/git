"use client";

import { useState, useTransition } from "react";

import { formatCurrency } from "@/lib/format/currency";
import type { GradeSalarySettingBundle } from "@/lib/grade-salary/grade-salary-setting-service";

export function GradeSalarySettingEditor({ canEdit, defaults }: { canEdit: boolean; defaults: GradeSalarySettingBundle }) {
  const [baseAmount, setBaseAmount] = useState(defaults.baseAmount);
  const [pointUnitAmount, setPointUnitAmount] = useState(defaults.pointUnitAmount);
  const [effectiveFrom, setEffectiveFrom] = useState(defaults.effectiveFrom);
  const [remarks, setRemarks] = useState(defaults.remarks);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sampleS = 60;
  const sampleB = 20;
  const sampleG = sampleS + sampleB;
  const sampleGradeAmount = sampleG * pointUnitAmount;
  const sampleTotal = baseAmount + sampleGradeAmount;

  function handleSave() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/grade-salary-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseAmount, pointUnitAmount, effectiveFrom, remarks }),
      });
      const result = await response.json();
      setMessage(result.message ?? "等級・給与計算設定を保存しました。");
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">計算の考え方</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">S点 = 自律成長力の最終評価点合計</div>
          <div className="rounded-xl bg-slate-50 p-4">B点 = 協調相乗力の最終評価点合計</div>
          <div className="rounded-xl bg-slate-50 p-4">本給 = ベース金額 + (G点 × 1点金額)</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">等級・給与計算設定</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            ベース金額
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" type="number" disabled={!canEdit || isPending} value={baseAmount} onChange={(e) => setBaseAmount(Number(e.target.value || 0))} />
          </label>
          <label className="text-sm text-slate-700">
            1点金額
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" type="number" disabled={!canEdit || isPending} value={pointUnitAmount} onChange={(e) => setPointUnitAmount(Number(e.target.value || 0))} />
          </label>
          <label className="text-sm text-slate-700">
            適用開始日
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" type="date" disabled={!canEdit || isPending} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </label>
          <label className="text-sm text-slate-700 md:col-span-2">
            備考
            <textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3" disabled={!canEdit || isPending} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </label>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button type="button" disabled={!canEdit || isPending} onClick={handleSave} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">保存</button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">プレビュー</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <article className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">自律成長力</p><p className="mt-2 text-2xl font-semibold text-slate-950">S{sampleS}</p></article>
          <article className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">協調相乗力</p><p className="mt-2 text-2xl font-semibold text-slate-950">B{sampleB}</p></article>
          <article className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">総合評価</p><p className="mt-2 text-2xl font-semibold text-slate-950">G{sampleG}</p></article>
          <article className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">等級計算金額</p><p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(sampleGradeAmount)}</p></article>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          ベース金額 {formatCurrency(baseAmount)} + (G{sampleG} × {formatCurrency(pointUnitAmount)}) = <span className="font-semibold text-slate-950">{formatCurrency(sampleTotal)}</span>
        </div>
      </section>
    </div>
  );
}
