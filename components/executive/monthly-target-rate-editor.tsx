"use client";

import { startTransition, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MonthlyTargetRow = {
  teamId: string;
  teamName: string;
  salesTotal: number;
  finalGrossProfit: number;
  actualGrossProfitRate: number;
  targetGrossProfitRate: number;
  varianceRate: number;
};

type MonthlyTargetRateEditorProps = {
  yearMonth: string;
  companyTargetGrossProfitRate: number;
  rows: MonthlyTargetRow[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function MonthlyTargetRateEditor({ yearMonth, companyTargetGrossProfitRate, rows }: MonthlyTargetRateEditorProps) {
  const router = useRouter();
  const [isPending, startSaving] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [targetGrossProfitRate, setTargetGrossProfitRate] = useState(companyTargetGrossProfitRate);

  const rowsWithTargets = useMemo(() => rows.map((row) => {
    const targetGrossProfitAmount = Math.round(row.salesTotal * (targetGrossProfitRate / 100));
    return {
      ...row,
      targetGrossProfitRate,
      targetGrossProfitAmount,
      varianceRate: Number((row.actualGrossProfitRate - targetGrossProfitRate).toFixed(2)),
    };
  }), [rows, targetGrossProfitRate]);

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch('/api/executive/monthly-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth,
          targets: rows.map((row) => ({
            teamId: row.teamId,
            targetGrossProfitRate,
          })),
        }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? '更新しました' : '更新に失敗しました'));

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
          <h2 className="text-xl font-semibold text-slate-950">全社目標粗利率</h2>
          <p className="mt-1 text-sm text-slate-500">経営トップで全社共通の目標粗利率を設定し、各チーム差異に反映します。</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-sm text-slate-600">
            目標粗利率
            <div className="mt-2 flex w-40 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="number"
                value={targetGrossProfitRate}
                onChange={(event) => setTargetGrossProfitRate(toNumber(event.target.value))}
                disabled={isPending}
                className="w-full bg-transparent text-sm text-slate-950 outline-none"
              />
              <span className="ml-2 text-sm text-slate-500">%</span>
            </div>
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? '処理中...' : '保存'}
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">チーム</th>
              <th className="px-4 py-3 font-medium">売上</th>
              <th className="px-4 py-3 font-medium">目標粗利率</th>
              <th className="px-4 py-3 font-medium">目標粗利額</th>
              <th className="px-4 py-3 font-medium">実績率</th>
              <th className="px-4 py-3 font-medium">差異</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithTargets.map((row) => (
              <tr key={`${row.teamId}-${yearMonth}`} className="border-t border-slate-200">
                <td className="px-4 py-3 font-medium text-slate-950">
                  <Link href={`/pl/monthly?teamId=${row.teamId}&yearMonth=${yearMonth}`} className="text-orange-700 underline-offset-4 hover:underline">
                    {row.teamName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatNumber(row.salesTotal)} 円</td>
                <td className="px-4 py-3 text-slate-700">{row.targetGrossProfitRate}%</td>
                <td className="px-4 py-3 text-slate-700">{formatNumber(row.targetGrossProfitAmount)} 円</td>
                <td className="px-4 py-3 text-slate-700">{row.actualGrossProfitRate}%</td>
                <td className={`px-4 py-3 font-semibold ${row.varianceRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {row.varianceRate >= 0 ? '+' : ''}{row.varianceRate}pt
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
    </article>
  );
}
