"use client";

import { startTransition, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AnnualTargetRateEditorProps = {
  fiscalYear: number;
  fiscalStartMonth: number;
  targetGrossProfitRate: number;
  canEdit: boolean;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function AnnualTargetRateEditor({ fiscalYear, fiscalStartMonth, targetGrossProfitRate, canEdit }: AnnualTargetRateEditorProps) {
  const router = useRouter();
  const [value, setValue] = useState(targetGrossProfitRate);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch('/api/pl/annual-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiscalYear,
          fiscalStartMonth,
          targetGrossProfitRate: value,
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? '保存しました' : '保存に失敗しました'));

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    });
  }

  return (
    <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">年度目標粗利率</h2>
          <p className="mt-1 text-sm text-slate-500">この年度の全月へ同じ目標粗利率を反映します。月次個別の変更は行いません。</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-sm text-slate-600">
            目標粗利率
            <div className="mt-2 flex w-40 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="number"
                value={value}
                onChange={(event) => setValue(toNumber(event.target.value))}
                disabled={!canEdit || isPending}
                className="w-full bg-transparent text-sm text-slate-950 outline-none"
              />
              <span className="ml-2 text-sm text-slate-500">%</span>
            </div>
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || isPending}
            className="rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? '処理中...' : '年度へ反映'}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p className="font-semibold">反映対象</p>
        <p className="mt-1">{fiscalYear}年度 / {String(fiscalStartMonth).padStart(2, '0')}月開始の12か月へ一括反映します。</p>
      </div>

      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
    </article>
  );
}
