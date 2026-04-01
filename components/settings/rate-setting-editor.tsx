"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { EmployeeRateRow, PartnerRateRow, TeamOption } from "@/lib/rates/rate-setting-service";

type RateSettingEditorProps = {
  canEdit: boolean;
  employeeDefaults: EmployeeRateRow[];
  partnerDefaults: PartnerRateRow[];
  teamOptions: TeamOption[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function RateSettingEditor({ canEdit, employeeDefaults, partnerDefaults, teamOptions }: RateSettingEditorProps) {
  const router = useRouter();
  const [employeeRates, setEmployeeRates] = useState(employeeDefaults);
  const [partnerRates, setPartnerRates] = useState(partnerDefaults);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const [deletedPartnerIds, setDeletedPartnerIds] = useState<string[]>([]);
  const [deletedEmployeeRateIds, setDeletedEmployeeRateIds] = useState<string[]>([]);
  const [deletedPartnerRateIds, setDeletedPartnerRateIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();

  async function handleSave() {
    setMessage(null);

    const normalizedEmployeeRates = employeeRates.map((row) => {
      const history = row.history.length > 0 ? [...row.history] : [{ id: `draft-${row.userId}`, effectiveFrom: row.effectiveFrom, unitPrice: row.unitPrice, defaultWorkRate: row.defaultWorkRate, remarks: row.remarks }];
      history[0] = {
        ...history[0],
        effectiveFrom: row.effectiveFrom,
        unitPrice: row.unitPrice,
        defaultWorkRate: row.defaultWorkRate,
        remarks: row.remarks,
      };
      return { ...row, history };
    });

    const normalizedPartnerRates = partnerRates.map((row) => {
      const history = row.history.length > 0 ? [...row.history] : [{ id: `draft-sales-${row.partnerId}:draft-out-${row.partnerId}`, effectiveFrom: row.effectiveFrom, unitPrice: row.salesUnitPrice, defaultWorkRate: row.defaultWorkRate, outsourceAmount: row.outsourceAmount, remarks: row.note }];
      history[0] = {
        ...history[0],
        effectiveFrom: row.effectiveFrom,
        unitPrice: row.salesUnitPrice,
        defaultWorkRate: row.defaultWorkRate,
        outsourceAmount: row.outsourceAmount,
        remarks: row.note,
      };
      return { ...row, history };
    });

    startSaving(async () => {
      const response = await fetch("/api/rate-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeRates: normalizedEmployeeRates,
          partnerRates: normalizedPartnerRates,
          deletedPartnerIds,
          deletedEmployeeRateIds,
          deletedPartnerRateIds,
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        data?: {
          employeeRates?: EmployeeRateRow[];
          partnerRates?: PartnerRateRow[];
        };
      };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));

      if (response.ok) {
        if (result.data?.employeeRates) {
          setEmployeeRates(result.data.employeeRates);
        }
        if (result.data?.partnerRates) {
          setPartnerRates(result.data.partnerRates);
        }
        setDeletedPartnerIds([]);
        setDeletedEmployeeRateIds([]);
        setDeletedPartnerRateIds([]);
        router.refresh();
      }
    });
  }

  function addPartner() {
    const defaultTeam = teamOptions[0];
    setPartnerRates((current) => [
      ...current,
      {
        partnerId: uid("new-partner"),
        partnerName: "",
        jurisdictionTeamId: defaultTeam?.teamId ?? "",
        jurisdictionTeamName: defaultTeam?.teamName ?? "",
        effectiveFrom: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
        salesUnitPrice: 0,
        defaultWorkRate: 100,
        outsourceAmount: 0,
        affiliation: "",
        note: "",
        history: [],
      },
    ]);
  }

  function removePartner(target: PartnerRateRow) {
    setPartnerRates((current) => current.filter((row) => row.partnerId !== target.partnerId));
    if (!target.partnerId.startsWith("new-")) {
      setDeletedPartnerIds((current) => [...current, target.partnerId]);
    }
  }
  function updateEmployeeHistoryRow(userId: string, historyId: string, key: "effectiveFrom" | "unitPrice" | "defaultWorkRate" | "remarks", value: string) {
    setEmployeeRates((current) => current.map((row) => {
      if (row.userId !== userId) return row;
      const history = row.history.map((historyRow) => historyRow.id === historyId ? {
        ...historyRow,
        [key]: key === "remarks" || key === "effectiveFrom" ? value : toNumber(value),
      } : historyRow);
      if (row.history[0]?.id !== historyId) {
        return { ...row, history };
      }
      const currentHistory = history[0];
      return {
        ...row,
        effectiveFrom: currentHistory?.effectiveFrom ?? row.effectiveFrom,
        unitPrice: currentHistory?.unitPrice ?? row.unitPrice,
        defaultWorkRate: currentHistory?.defaultWorkRate ?? row.defaultWorkRate,
        remarks: currentHistory?.remarks ?? row.remarks,
        history,
      };
    }));
  }

  function removeEmployeeHistoryRow(userId: string, historyId: string) {
    setEmployeeRates((current) => current.map((row) => {
      if (row.userId !== userId) return row;
      return {
        ...row,
        history: row.history.filter((historyRow) => historyRow.id !== historyId),
      };
    }));
    if (!historyId.startsWith("draft-")) {
      setDeletedEmployeeRateIds((current) => Array.from(new Set([...current, historyId])));
    }
  }

  function updatePartnerHistoryRow(partnerId: string, historyId: string, key: "effectiveFrom" | "unitPrice" | "defaultWorkRate" | "outsourceAmount" | "remarks", value: string) {
    setPartnerRates((current) => current.map((row) => {
      if (row.partnerId !== partnerId) return row;
      const history = row.history.map((historyRow) => historyRow.id === historyId ? {
        ...historyRow,
        [key]: key === "remarks" || key === "effectiveFrom" ? value : toNumber(value),
      } : historyRow);
      if (row.history[0]?.id !== historyId) {
        return { ...row, history };
      }
      const currentHistory = history[0];
      return {
        ...row,
        effectiveFrom: currentHistory?.effectiveFrom ?? row.effectiveFrom,
        salesUnitPrice: currentHistory?.unitPrice ?? row.salesUnitPrice,
        defaultWorkRate: currentHistory?.defaultWorkRate ?? row.defaultWorkRate,
        outsourceAmount: currentHistory?.outsourceAmount ?? row.outsourceAmount,
        note: currentHistory?.remarks ?? row.note,
        history,
      };
    }));
  }

  function removePartnerHistoryRow(partnerId: string, historyId: string) {
    setPartnerRates((current) => current.map((row) => {
      if (row.partnerId !== partnerId) return row;
      return {
        ...row,
        history: row.history.filter((historyRow) => historyRow.id !== historyId),
      };
    }));
    if (!historyId.includes("draft-")) {
      setDeletedPartnerRateIds((current) => Array.from(new Set([...current, historyId])));
    }
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">単価・外注費基準値</h2>
        <p className="mt-1 text-sm text-slate-500">社員単価、パートナー単価、外注費を適用開始日つきの履歴で管理します。月次PLでは対象月時点で有効な最新値を初期表示します。</p>
      </div>

      <section className="rounded-3xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">社員売上単価</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">社員コード</th>
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">チーム</th>
                <th className="px-4 py-3 font-medium">適用開始日</th>
                <th className="px-4 py-3 font-medium">標準単価</th>
                <th className="px-4 py-3 font-medium">標準稼働率</th>
                <th className="px-4 py-3 font-medium">備考</th>
                <th className="px-4 py-3 font-medium">履歴</th>
              </tr>
            </thead>
            <tbody>
              {employeeRates.map((row) => {
                const expanded = expandedEmployeeId === row.userId;
                return (
                  <Fragment key={row.userId}>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-950">{row.employeeCode}</td>
                      <td className="px-4 py-3 text-slate-700">{row.employeeName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                      <td className="px-4 py-3">
                        <input type="date" value={row.effectiveFrom} disabled={!canEdit || isPending} onChange={(event) => setEmployeeRates((current) => current.map((item) => item.userId === row.userId ? { ...item, effectiveFrom: event.target.value } : item))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" value={row.unitPrice} disabled={!canEdit || isPending} onChange={(event) => setEmployeeRates((current) => current.map((item) => item.userId === row.userId ? { ...item, unitPrice: toNumber(event.target.value) } : item))} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" value={row.defaultWorkRate} disabled={!canEdit || isPending} onChange={(event) => setEmployeeRates((current) => current.map((item) => item.userId === row.userId ? { ...item, defaultWorkRate: toNumber(event.target.value) } : item))} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="text" value={row.remarks} disabled={!canEdit || isPending} onChange={(event) => setEmployeeRates((current) => current.map((item) => item.userId === row.userId ? { ...item, remarks: event.target.value } : item))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setExpandedEmployeeId(expanded ? null : row.userId)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                          {expanded ? "閉じる" : `履歴 (${row.history.length})`}
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="overflow-x-auto">
                              <table className="min-w-[680px] text-left text-xs sm:text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">適用開始日</th>
                                    <th className="px-3 py-2 font-medium">標準単価</th>
                                    <th className="px-3 py-2 font-medium">標準稼働率</th>
                                    <th className="px-3 py-2 font-medium">備考</th>
                                    <th className="px-3 py-2 font-medium">操作</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.history.map((historyRow, index) => (
                                    <tr key={historyRow.id} className="border-t border-slate-100">
                                      <td className="px-3 py-2 text-slate-700"><input type="date" value={historyRow.effectiveFrom} disabled={!canEdit || isPending} onChange={(event) => updateEmployeeHistoryRow(row.userId, historyRow.id, "effectiveFrom", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2 text-slate-700"><input type="number" value={historyRow.unitPrice} disabled={!canEdit || isPending} onChange={(event) => updateEmployeeHistoryRow(row.userId, historyRow.id, "unitPrice", event.target.value)} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2 text-slate-700"><input type="number" value={historyRow.defaultWorkRate} disabled={!canEdit || isPending} onChange={(event) => updateEmployeeHistoryRow(row.userId, historyRow.id, "defaultWorkRate", event.target.value)} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2 text-slate-700"><input type="text" value={historyRow.remarks} disabled={!canEdit || isPending} onChange={(event) => updateEmployeeHistoryRow(row.userId, historyRow.id, "remarks", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2">{canEdit && index > 0 ? <button type="button" onClick={() => removeEmployeeHistoryRow(row.userId, historyRow.id)} disabled={isPending} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600">削除</button> : <span className="text-xs text-slate-400">{index === 0 ? "現在値" : "-"}</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-950">パートナー単価・外注費</h3>
          <button type="button" onClick={addPartner} disabled={!canEdit || isPending} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            パートナー追加
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1440px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">パートナー名</th>
                <th className="px-4 py-3 font-medium">管轄</th>
                <th className="px-4 py-3 font-medium">適用開始日</th>
                <th className="px-4 py-3 font-medium">売上単価</th>
                <th className="px-4 py-3 font-medium">標準稼働率</th>
                <th className="px-4 py-3 font-medium">外注費</th>
                <th className="px-4 py-3 font-medium">所属</th>
                <th className="px-4 py-3 font-medium">備考</th>
                <th className="px-4 py-3 font-medium">履歴</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {partnerRates.map((row) => {
                const expanded = expandedPartnerId === row.partnerId;
                return (
                  <Fragment key={row.partnerId}>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        <input type="text" value={row.partnerName} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, partnerName: event.target.value } : item))} className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <select value={row.jurisdictionTeamId} disabled={!canEdit || isPending} onChange={(event) => {
                          const selected = teamOptions.find((option) => option.teamId === event.target.value);
                          setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, jurisdictionTeamId: event.target.value, jurisdictionTeamName: selected?.teamName ?? "未設定" } : item));
                        }} className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">未設定</option>
                          {teamOptions.map((option) => (
                            <option key={option.teamId} value={option.teamId}>{option.teamName}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input type="date" value={row.effectiveFrom} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, effectiveFrom: event.target.value } : item))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </td>
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
                        <input type="text" value={row.affiliation} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, affiliation: event.target.value } : item))} className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="text" value={row.note} disabled={!canEdit || isPending} onChange={(event) => setPartnerRates((current) => current.map((item) => item.partnerId === row.partnerId ? { ...item, note: event.target.value } : item))} className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setExpandedPartnerId(expanded ? null : row.partnerId)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                          {expanded ? "閉じる" : `履歴 (${row.history.length})`}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => removePartner(row)} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 px-3 py-2 text-xs text-rose-600">削除</button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="overflow-x-auto">
                              <table className="min-w-[780px] text-left text-xs sm:text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">適用開始日</th>
                                    <th className="px-3 py-2 font-medium">売上単価</th>
                                    <th className="px-3 py-2 font-medium">標準稼働率</th>
                                    <th className="px-3 py-2 font-medium">外注費</th>
                                    <th className="px-3 py-2 font-medium">備考</th>
                                    <th className="px-3 py-2 font-medium">操作</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.history.map((historyRow, index) => (
                                    <tr key={historyRow.id} className="border-t border-slate-100">
                                      <td className="px-3 py-2 text-slate-700"><input type="date" value={historyRow.effectiveFrom} disabled={!canEdit || isPending} onChange={(event) => updatePartnerHistoryRow(row.partnerId, historyRow.id, "effectiveFrom", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2 text-slate-700"><input type="number" value={historyRow.unitPrice} disabled={!canEdit || isPending} onChange={(event) => updatePartnerHistoryRow(row.partnerId, historyRow.id, "unitPrice", event.target.value)} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2 text-slate-700"><input type="number" value={historyRow.defaultWorkRate} disabled={!canEdit || isPending} onChange={(event) => updatePartnerHistoryRow(row.partnerId, historyRow.id, "defaultWorkRate", event.target.value)} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2 text-slate-700"><input type="number" value={historyRow.outsourceAmount ?? 0} disabled={!canEdit || isPending} onChange={(event) => updatePartnerHistoryRow(row.partnerId, historyRow.id, "outsourceAmount", event.target.value)} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2 text-slate-700"><input type="text" value={historyRow.remarks} disabled={!canEdit || isPending} onChange={(event) => updatePartnerHistoryRow(row.partnerId, historyRow.id, "remarks", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></td>
                                      <td className="px-3 py-2">{canEdit && index > 0 ? <button type="button" onClick={() => removePartnerHistoryRow(row.partnerId, historyRow.id)} disabled={isPending} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600">削除</button> : <span className="text-xs text-slate-400">{index === 0 ? "現在値" : "-"}</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
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
