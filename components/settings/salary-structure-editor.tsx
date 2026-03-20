"use client";

import { useState, useTransition } from "react";

import { formatCurrency } from "@/lib/format/currency";

type SalaryStructureBand = {
  code: string;
  name: string;
  amount: number;
  description: string;
};

type GrossProfitAdjustmentRow = {
  id: string;
  label: string;
  minRate: number;
  maxRate: number | null;
  multiplier: number;
};

type SalaryStructureBundle = {
  selfGrowthBands: SalaryStructureBand[];
  synergyBands: SalaryStructureBand[];
  grossProfitAdjustments: GrossProfitAdjustmentRow[];
  source: "default" | "file";
};

type BandGroup = "selfGrowth" | "synergy";

function createEmptyAdjustment(index: number): GrossProfitAdjustmentRow {
  return {
    id: `gp-${index}`,
    label: `新しい帯 ${index}`,
    minRate: 0,
    maxRate: null,
    multiplier: 1,
  };
}

function createEmptyBand(group: BandGroup, index: number): SalaryStructureBand {
  const prefix = group === "selfGrowth" ? "SG" : "KG";
  return {
    code: `${prefix}${index}`,
    name: "",
    amount: 0,
    description: "",
  };
}

export function SalaryStructureEditor({ canEdit, defaults }: { canEdit: boolean; defaults: SalaryStructureBundle }) {
  const [selfGrowthBands, setSelfGrowthBands] = useState(defaults.selfGrowthBands);
  const [synergyBands, setSynergyBands] = useState(defaults.synergyBands);
  const [grossProfitAdjustments, setGrossProfitAdjustments] = useState(defaults.grossProfitAdjustments);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateBand(
    setter: React.Dispatch<React.SetStateAction<SalaryStructureBand[]>>,
    code: string,
    field: keyof SalaryStructureBand,
    value: string,
  ) {
    setter((current) =>
      current.map((band) =>
        band.code === code
          ? {
              ...band,
              [field]: field === "amount" ? Number(value || 0) : value,
            }
          : band,
      ),
    );
  }

  function addBand(group: BandGroup) {
    const setter = group === "selfGrowth" ? setSelfGrowthBands : setSynergyBands;
    setter((current) => [...current, createEmptyBand(group, current.length + 1)]);
  }

  function removeBand(group: BandGroup, code: string) {
    const setter = group === "selfGrowth" ? setSelfGrowthBands : setSynergyBands;
    setter((current) => current.filter((band) => band.code !== code));
  }

  function updateAdjustment(id: string, field: keyof GrossProfitAdjustmentRow, value: string) {
    setGrossProfitAdjustments((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: field === "label" || field === "id" ? value : value === "" && field === "maxRate" ? null : Number(value),
            }
          : row,
      ),
    );
  }

  function addAdjustment() {
    setGrossProfitAdjustments((current) => [...current, createEmptyAdjustment(current.length + 1)]);
  }

  function removeAdjustment(id: string) {
    setGrossProfitAdjustments((current) => current.filter((row) => row.id !== id));
  }

  function handleSave() {
    startTransition(async () => {
      setMessage(null);

      const response = await fetch("/api/salary-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfGrowthBands, synergyBands, grossProfitAdjustments }),
      });

      const result = await response.json();
      setMessage(result.message ?? "給与構成設定を保存しました。");
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">計算の考え方</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">基準基本給 = 自律成長基準額 + 協調相乗基準額</div>
          <div className="rounded-xl bg-slate-50 p-4">最終基本給案 = 基準基本給 × 粗利補正係数</div>
          <div className="rounded-xl bg-slate-50 p-4">昇給額 = 最終基本給案 - 現在基本給</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">自律成長基準額</h2>
            <p className="mt-1 text-sm text-slate-500">等級数は固定せず、制度に合わせて追加・削除できます。</p>
          </div>
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit}
            onClick={() => addBand("selfGrowth")}
            type="button"
          >
            等級を追加
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">等級</th>
                <th className="px-3 py-2">名称</th>
                <th className="px-3 py-2">基準額</th>
                <th className="px-3 py-2">説明</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {selfGrowthBands.map((band) => (
                <tr key={band.code} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-900"
                      disabled={!canEdit}
                      value={band.code}
                      onChange={(event) => updateBand(setSelfGrowthBands, band.code, "code", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      value={band.name}
                      onChange={(event) => updateBand(setSelfGrowthBands, band.code, "name", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      type="number"
                      value={band.amount}
                      onChange={(event) => updateBand(setSelfGrowthBands, band.code, "amount", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      value={band.description}
                      onChange={(event) => updateBand(setSelfGrowthBands, band.code, "description", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canEdit || selfGrowthBands.length <= 1}
                      onClick={() => removeBand("selfGrowth", band.code)}
                      type="button"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">協調相乗基準額</h2>
            <p className="mt-1 text-sm text-slate-500">等級数は固定せず、制度に合わせて追加・削除できます。</p>
          </div>
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit}
            onClick={() => addBand("synergy")}
            type="button"
          >
            等級を追加
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">等級</th>
                <th className="px-3 py-2">名称</th>
                <th className="px-3 py-2">基準額</th>
                <th className="px-3 py-2">説明</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {synergyBands.map((band) => (
                <tr key={band.code} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-900"
                      disabled={!canEdit}
                      value={band.code}
                      onChange={(event) => updateBand(setSynergyBands, band.code, "code", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      value={band.name}
                      onChange={(event) => updateBand(setSynergyBands, band.code, "name", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      type="number"
                      value={band.amount}
                      onChange={(event) => updateBand(setSynergyBands, band.code, "amount", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      value={band.description}
                      onChange={(event) => updateBand(setSynergyBands, band.code, "description", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canEdit || synergyBands.length <= 1}
                      onClick={() => removeBand("synergy", band.code)}
                      type="button"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">粗利補正</h2>
            <p className="mt-1 text-sm text-slate-500">達成率帯も固定せず、制度に合わせて追加・削除できます。</p>
          </div>
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit}
            onClick={addAdjustment}
            type="button"
          >
            帯を追加
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">帯</th>
                <th className="px-3 py-2">下限</th>
                <th className="px-3 py-2">上限</th>
                <th className="px-3 py-2">係数</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {grossProfitAdjustments.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-900"
                      disabled={!canEdit}
                      value={row.id}
                      onChange={(event) => updateAdjustment(row.id, "id", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      value={row.label}
                      onChange={(event) => updateAdjustment(row.id, "label", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      type="number"
                      step="0.01"
                      value={row.minRate}
                      onChange={(event) => updateAdjustment(row.id, "minRate", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      type="number"
                      step="0.01"
                      value={row.maxRate ?? ""}
                      onChange={(event) => updateAdjustment(row.id, "maxRate", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      disabled={!canEdit}
                      type="number"
                      step="0.001"
                      value={row.multiplier}
                      onChange={(event) => updateAdjustment(row.id, "multiplier", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canEdit || grossProfitAdjustments.length <= 1}
                      onClick={() => removeAdjustment(row.id)}
                      type="button"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">基準基本給の見え方</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">自律成長</th>
                {synergyBands.map((band) => (
                  <th key={band.code} className="px-3 py-2">{band.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selfGrowthBands.map((selfBand) => (
                <tr key={selfBand.code} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-900">{selfBand.code}</td>
                  {synergyBands.map((synergyBand) => (
                    <td key={synergyBand.code} className="px-3 py-3 text-slate-700">
                      ¥{formatCurrency(selfBand.amount + synergyBand.amount)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          保存すると、以後の給与構成検討の基準としてこの金額と粗利補正を使えます。
        </p>
        <div className="flex items-center gap-3">
          {message ? <span className="text-sm text-emerald-600">{message}</span> : null}
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!canEdit || isPending}
            onClick={handleSave}
            type="button"
          >
            {isPending ? "保存中..." : "給与構成設定を保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
