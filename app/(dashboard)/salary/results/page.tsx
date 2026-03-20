import Link from "next/link";

import { AuditLogExportButton } from "@/components/settings/audit-log-export-button";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getEvaluationPeriodOptions } from "@/lib/evaluations/period-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSalarySimulationBundle } from "@/lib/salary-simulations/salary-simulation-service";
import { formatCurrencyWithUnit, formatSignedCurrencyWithUnit } from "@/lib/format/currency";

export default async function SalaryResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ evaluationPeriodId?: string; status?: string; onlyAdjusted?: string }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const canView = hasPermission(user, PERMISSIONS.salaryRead);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">昇給結果一覧</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
            <div className="mt-6">
              <Link href="/dashboard" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                ダッシュボードへ戻る
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const bundle = await getSalarySimulationBundle(params.evaluationPeriodId);
  const periods = await getEvaluationPeriodOptions();
  const approvedCount = bundle.rows.filter((row) => row.status === "APPROVED").length;
  const appliedCount = bundle.rows.filter((row) => row.status === "APPLIED").length;
  const totalRaise = bundle.rows.reduce((sum, row) => sum + row.proposedRaiseAmount, 0);
  const filteredRows = bundle.rows.filter((row) => {
    const matchesStatus = !params.status || params.status === "ALL" ? true : row.status === params.status;
    const matchesAdjusted = params.onlyAdjusted === "1" ? row.newSalary !== row.finalSalaryReference : true;
    return matchesStatus && matchesAdjusted;
  });

  const exportRows = filteredRows.map((row) => ({
    actedAt: bundle.periodName,
    kind: row.status,
    actorName: row.employeeName,
    action: row.overallGradeName,
    targetType: row.finalRating,
    targetId: row.teamName,
    comment: `参考:${formatCurrencyWithUnit(row.finalSalaryReference)} / 決定:${formatCurrencyWithUnit(row.newSalary)} / 差額:${formatSignedCurrencyWithUnit(row.newSalary - row.finalSalaryReference)} / 理由:${row.adjustmentReason || "-"}`,
  }));

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Salary Results</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">昇給結果一覧</h1>
              <p className="mt-2 text-sm text-slate-300">決定額、参考額との差、調整理由、承認状態を一覧で確認します。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {periods.map((period) => {
                  const active = period.id === bundle.evaluationPeriodId;
                  return (
                    <Link
                      key={period.id}
                      href={`/salary/results?evaluationPeriodId=${period.id}`}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "border border-brand-300 bg-brand-200 text-black shadow-sm font-semibold" : "border border-slate-200 bg-white/90 text-black"}`}
                    >
                      <span style={{ color: "#000000" }}>{period.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <Link href={`/salary/simulations?evaluationPeriodId=${bundle.evaluationPeriodId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                昇給シミュレーション
              </Link>
              <Link href="/settings/audit-logs?action=SALARY_SIMULATION" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                監査ログ
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">対象人数</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{bundle.rows.length} 名</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">承認済 / 反映済</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{approvedCount} / {appliedCount}</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">昇給総額</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrencyWithUnit(totalRaise)}</p>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <form method="get" className="grid gap-4 rounded-[1.5rem] bg-slate-50 p-4 md:grid-cols-4 md:items-end">
            <input type="hidden" name="evaluationPeriodId" value={bundle.evaluationPeriodId} />
            <label className="text-sm text-slate-700">
              状態
              <select name="status" defaultValue={params.status ?? "ALL"} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="ALL">すべて</option>
                <option value="DRAFT">DRAFT</option>
                <option value="APPROVED">APPROVED</option>
                <option value="APPLIED">APPLIED</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:pb-3">
              <input type="checkbox" name="onlyAdjusted" value="1" defaultChecked={params.onlyAdjusted === "1"} className="h-4 w-4 rounded border-slate-300" />
              差額ありのみ表示
            </label>
            <div className="flex gap-3">
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">絞り込む</button>
              <Link href={`/salary/results?evaluationPeriodId=${bundle.evaluationPeriodId}`} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">リセット</Link>
            </div>
            <div className="flex justify-start md:justify-end">
              <AuditLogExportButton rows={exportRows} filters={{ kind: params.status, actor: params.onlyAdjusted === "1" ? "adjusted" : undefined, action: bundle.evaluationPeriodId }} />
            </div>
          </form>
        </section>

        <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1650px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">氏名</th>
                  <th className="px-4 py-3 font-medium">チーム</th>
                  <th className="px-4 py-3 font-medium">総合等級</th>
                  <th className="px-4 py-3 font-medium">期待充足ランク</th>
                  <th className="px-4 py-3 font-medium">新月額(参考)</th>
                  <th className="px-4 py-3 font-medium">決定額</th>
                  <th className="px-4 py-3 font-medium">差額</th>
                  <th className="px-4 py-3 font-medium">差率</th>
                  <th className="px-4 py-3 font-medium">昇給額</th>
                  <th className="px-4 py-3 font-medium">調整理由</th>
                  <th className="px-4 py-3 font-medium">状態</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const diffAmount = row.newSalary - row.finalSalaryReference;
                  const diffRate = row.finalSalaryReference === 0 ? 0 : Math.round((diffAmount / row.finalSalaryReference) * 10000) / 100;
                  return (
                    <tr key={row.userId} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-3 font-medium text-slate-950"><Link href={`/salary/results/${row.userId}?evaluationPeriodId=${row.evaluationPeriodId}`} className="underline-offset-4 hover:underline">{row.employeeName}</Link></td>
                      <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.overallGradeName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.finalRating}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(row.finalSalaryReference)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-950">{formatCurrencyWithUnit(row.newSalary)}</td>
                      <td className={`px-4 py-3 font-semibold ${diffAmount === 0 ? "text-slate-700" : diffAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatSignedCurrencyWithUnit(diffAmount)}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${diffAmount === 0 ? "text-slate-700" : diffAmount > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {(diffRate > 0 ? "+" : "") + diffRate}%
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrencyWithUnit(row.proposedRaiseAmount)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.adjustmentReason || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === "APPLIED" ? "bg-emerald-50 text-emerald-700" : row.status === "APPROVED" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-700"}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr className="border-t border-slate-200">
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-500">条件に一致する結果がありません。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
