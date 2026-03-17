"use client";

import { startTransition, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type MonthlyPlEditorProps = {
  teamId: string;
  yearMonth: string;
  canEdit: boolean;
  defaults: {
    salesTotal: number;
    directLaborCost: number;
    outsourcingCost: number;
    indirectCost: number;
    fixedCostAllocation: number;
    targetGrossProfitRate: number;
  };
};

type FormState = MonthlyPlEditorProps["defaults"];

type FieldConfig = {
  key: keyof FormState;
  label: string;
  suffix: string;
  readOnly?: boolean;
  helper?: string;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function MonthlyPlEditor({ teamId, yearMonth, canEdit, defaults }: MonthlyPlEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  function updateField<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({
      ...current,
      [key]: toNumber(value),
    }));
  }

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/pl/monthly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          yearMonth,
          ...form,
        }),
      });

      const result = (await response.json()) as { message?: string; persisted?: boolean };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    });
  }

  async function handleRecalculate() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch(`/api/pl/recalculate/${teamId}?yearMonth=${yearMonth}`, {
        method: "POST",
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "再計算しました" : "再計算に失敗しました"));

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    });
  }

  const fields: FieldConfig[] = [
    { key: "salesTotal", label: "売上合計", suffix: "円" },
    { key: "directLaborCost", label: "人件費", suffix: "円", readOnly: true, helper: "社員コストと所属情報から自動集計される想定値です。" },
    { key: "outsourcingCost", label: "外注費", suffix: "円" },
    { key: "indirectCost", label: "チーム経費", suffix: "円" },
    { key: "fixedCostAllocation", label: "全社固定費按分", suffix: "円", readOnly: true, helper: "全社固定費を社員人数比で按分した結果です。" },
    { key: "targetGrossProfitRate", label: "目標粗利率", suffix: "%" },
  ];

  return (
    <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">月次PL入力</h2>
          <p className="mt-1 text-sm text-stone-500">売上・外注費・チーム経費・目標粗利率の補正用フォームです。人件費と固定費按分は自動計算されます。</p>
        </div>
        {!canEdit ? <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-500">閲覧専用</span> : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const disabled = !canEdit || isPending || field.readOnly;

          return (
            <label key={field.key} className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">{field.label}</span>
              <div className={`flex items-center rounded-2xl border px-4 py-3 ${field.readOnly ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-stone-50"}`}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  disabled={disabled}
                  className="w-full bg-transparent text-sm text-stone-950 outline-none disabled:text-stone-500"
                />
                <span className="ml-3 text-sm text-stone-500">{field.suffix}</span>
              </div>
              {field.helper ? <span className="mt-2 block text-xs text-stone-500">{field.helper}</span> : null}
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || isPending}
          className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {isPending ? "処理中..." : "保存する"}
        </button>
        <button
          type="button"
          onClick={handleRecalculate}
          disabled={!canEdit || isPending}
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:text-stone-300"
        >
          再計算API実行
        </button>
      </div>

      {message ? <p className="mt-4 text-sm text-stone-600">{message}</p> : null}
    </section>
  );
}

