"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EvaluationPeriodAdminBundle, EvaluationPeriodAdminRow } from "@/lib/evaluations/evaluation-period-admin-service";

type EvaluationPeriodEditorProps = {
  canEdit: boolean;
  defaults: EvaluationPeriodAdminBundle;
};

type EditableRow = EvaluationPeriodAdminRow;
type PeriodTypeValue = EditableRow["periodType"];
type EvaluationPeriodStatusValue = EditableRow["status"];

const PERIOD_TYPE_OPTIONS: ReadonlyArray<{ value: PeriodTypeValue; label: string }> = [
  { value: "HALF_YEAR", label: "半期" },
  { value: "YEAR", label: "年度" },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: EvaluationPeriodStatusValue; label: string }> = [
  { value: "DRAFT", label: "準備中" },
  { value: "OPEN", label: "入力受付中" },
  { value: "CLOSED", label: "閲覧専用" },
  { value: "FINALIZED", label: "最終確定済み" },
];


function createRow(): EditableRow {
  return {
    id: "",
    name: "",
    periodType: "HALF_YEAR",
    startDate: "",
    endDate: "",
    status: "DRAFT",
    evaluationCount: 0,
  };
}

export function EvaluationPeriodEditor({ canEdit, defaults }: EvaluationPeriodEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableRow[]>(defaults.rows);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isPreview = defaults.source !== "database";
  const canPersist = canEdit && !isPreview;

  function updateRow(index: number, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/evaluation-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const result = (await response.json()) as { data?: EvaluationPeriodAdminBundle; message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));
      if (response.ok) {
        if (result.data) {
          setRows(result.data.rows);
        }
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">評価期間マスタ</h2>
          <p className="mt-1 text-sm text-slate-500">自己評価、上長評価、最終評価で共通利用する評価期間を管理します。入力受付中 (OPEN) は原則1件にしてください。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canPersist || isPending}
            onClick={() => setRows((current) => [createRow(), ...current])}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            評価期間を追加
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canPersist || isPending}
            className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {isPending ? "処理中..." : "評価期間を保存"}
          </button>
        </div>
      </div>

      {isPreview ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-semibold">DB未接続のため保存できません</p>
          <p className="mt-1 text-rose-800">この画面はプレビュー表示です。追加・編集内容は再読込後に保持されません。DATABASE_URL と DB 接続状態を確認してください。</p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">現在の件数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">入力受付中</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-950">{rows.filter((row) => row.status === "OPEN").length}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.22em] text-sky-700">確定済み</p>
          <p className="mt-2 text-2xl font-semibold text-sky-950">{rows.filter((row) => row.status === "FINALIZED").length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200">
        <table className="min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">期間名</th>
              <th className="px-4 py-3 font-medium">種別</th>
              <th className="px-4 py-3 font-medium">開始日</th>
              <th className="px-4 py-3 font-medium">終了日</th>
              <th className="px-4 py-3 font-medium">状態</th>
              <th className="px-4 py-3 font-medium">利用件数</th>
              <th className="px-4 py-3 font-medium">初期設定</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              return (
                <tr key={row.id || `row-${index}`} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.name}
                      disabled={!canPersist || isPending}
                      onChange={(event) => updateRow(index, { name: event.target.value })}
                      placeholder="例: 2025年度下期"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.periodType}
                      disabled={!canPersist || isPending}
                      onChange={(event) => updateRow(index, { periodType: event.target.value as PeriodTypeValue })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {PERIOD_TYPE_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={row.startDate}
                      disabled={!canPersist || isPending}
                      onChange={(event) => updateRow(index, { startDate: event.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={row.endDate}
                      disabled={!canPersist || isPending}
                      onChange={(event) => updateRow(index, { endDate: event.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.status}
                      disabled={!canPersist || isPending}
                      onChange={(event) => updateRow(index, { status: event.target.value as EvaluationPeriodStatusValue })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {STATUS_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <p className="font-semibold text-slate-950">{row.evaluationCount}件</p>
                    <p className="mt-1 text-xs text-slate-500">{row.id ? `ID: ${row.id}` : "保存後にIDを採番します"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {row.id ? (
                      <Link
                        href={`/evaluations/admin?evaluationPeriodId=${row.id}`}
                        className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        評価初期設定
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">保存後に利用できます</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">運用メモ</p>
        <ul className="mt-2 space-y-1 text-amber-800">
          <li>OPEN: 自己評価・上長評価を入力できます。</li>
          <li>CLOSED: 最終評価のみ確定できます。</li>
          <li>FINALIZED: すべて閲覧専用です。</li>
        </ul>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
