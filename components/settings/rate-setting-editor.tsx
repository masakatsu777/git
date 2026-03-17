"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { EmployeeRateRow, PartnerRateRow } from "@/lib/rates/rate-setting-service";

type RateSettingEditorProps = {
  canEdit: boolean;
  employeeDefaults: EmployeeRateRow[];
  partnerDefaults: PartnerRateRow[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function RateSettingEditor({ canEdit, employeeDefaults, partnerDefaults }: RateSettingEditorProps) {
  const router = useRouter();
  const [employeeRates, setEmployeeRates] = useState(employeeDefaults);
  const [partnerRates, setPartnerRates] = useState(partnerDefaults);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  async function handleSave() {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/rate-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeRates, partnerRates }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));

      if (response.ok) {
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">単価・外注費基準値</h2>
        <p className="mt-1 text-sm text-slate-500">月次PL明細で社員やパートナーを選択したときの初期値として使います。</p>
      </div>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">社員売上単価</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">社員コード</th>
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">所属</th>
                <th className="px-4 py-3 font-medium">標準単価</th>
                <th className="px-4 py-3 font-medium">標準稼働率</th>
                <th className="px-4 py-3 font-medium">備考</th>
              </tr>
            </thead>
            <tbody>
              {employeeRates.map((row) => (
                <tr key={row.userId} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-950">{row.employeeCode}</td>
                  <td className="px-4 py-3 text-slate-700">{row.employeeName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.unitPrice} disabled={!canEdit || isPending} onChange={(event) => setEmployeeRates((current) => current.map((item) => item.userId === row.userId ? { ...item, unitPrice: toNumber(event.target.value) } : item))} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.defaultWorkRate} disabled={!canEdit || isPending} onChange={(event) => setEmployeeRates((current) => current.map((item) => item.userId === row.userId ? { ...item, defaultWorkRate: toNumber(event.target.value) } : item))} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={row.remarks} disabled={!canEdit || isPending} onChange={(event) => setEmployeeRates((current) => current.map((item) => item.userId === row.userId ? { ...item, remarks: event.target.value } : item))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">パートナー売上単価・外注費</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">パートナー</th>
                <th className="px-4 py-3 font-medium">会社名</th>
                <th className="px-4 py-3 font-medium">売上単価</th>
                <th className="px-4 py-3 font-medium">標準稼働率</th>
                <th className="px-4 py-3 font-medium">外注費</th>
                <th className="px-4 py-3 font-medium">売上備考</th>
                <th className="px-4 py-3 font-medium">外注備考</th>
              </tr>
            </thead>
            <tbody>
              {partnerRates.map((row) => (
                <tr key={row.partnerId} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-950">{row.partnerName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.companyName}</td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.salesUnitPrice} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, salesUnitPrice: toNumber(event.target.value) } : item))} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.defaultWorkRate} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, defaultWorkRate: toNumber(event.target.value) } : item))} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={row.outsourceAmount} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, outsourceAmount: toNumber(event.target.value) } : item))} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={row.salesRemarks} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, salesRemarks: event.target.value } : item))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={row.outsourceRemarks} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, outsourceRemarks: event.target.value } : item))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "基準値を保存"}
        </button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}

