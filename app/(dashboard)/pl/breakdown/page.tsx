import Link from "next/link";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getProfitBreakdownBundle } from "@/lib/pl/profit-breakdown-service";
import { formatCurrencyWithUnit } from "@/lib/format/currency";


export default async function ProfitBreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{
    rangeStartYearMonth?: string;
    rangeEndYearMonth?: string;
    departmentId?: string;
    teamId?: string;
    subjectType?: "ALL" | "EMPLOYEE" | "PARTNER";
    membershipFilter?: "ALL" | "ASSIGNED" | "UNASSIGNED";
    keyword?: string;
  }>;
}) {
  const user = await getSessionUser();
  const canView = user.role === "admin" || user.role === "president";

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-6 py-16 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-10 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h1 className="text-3xl font-semibold">月次粗利内訳一覧</h1>
          <p className="mt-3 text-slate-600">この画面は管理者または役員のみ利用できます。</p>
          <Link href="/executive" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            経営トップへ戻る
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const bundle = await getProfitBreakdownBundle(params);
  const filteredTeamOptions = bundle.filters.departmentId
    ? bundle.teamOptions.filter((team) => team.departmentId === bundle.filters.departmentId)
    : bundle.teamOptions;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf7_0%,#f7f2e8_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-stone-950 px-8 py-7 text-stone-50 shadow-[0_30px_80px_rgba(41,37,36,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-amber-200">Profit Breakdown</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">粗利内訳一覧</h1>
              <p className="mt-2 text-sm text-stone-300">開始月から終了月までの累計で、社員とパートナーを 1 件ずつ確認できます。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/executive" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                経営トップへ
              </Link>
              <Link href="/pl/monthly" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月次PL詳細へ
              </Link>
            </div>
          </div>

          <form method="get" className="mt-5 grid gap-4 rounded-[1.5rem] bg-white/10 p-4 md:grid-cols-3 xl:grid-cols-6 xl:items-end">
            <label className="text-sm text-white">
              開始月
              <select name="rangeStartYearMonth" defaultValue={bundle.rangeStartYearMonth} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.yearMonthOptions.map((option) => (
                  <option key={`start-${option.yearMonth}`} value={option.yearMonth}>{option.yearMonth}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-white">
              終了月
              <select name="rangeEndYearMonth" defaultValue={bundle.rangeEndYearMonth} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.yearMonthOptions.map((option) => (
                  <option key={`end-${option.yearMonth}`} value={option.yearMonth}>{option.yearMonth}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-white">
              部署
              <select name="departmentId" defaultValue={bundle.filters.departmentId} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.departmentOptions.map((option) => (
                  <option key={option.id || "all"} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-white">
              チーム
              <select name="teamId" defaultValue={bundle.filters.teamId} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="">すべて</option>
                {filteredTeamOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-white">
              区分
              <select name="subjectType" defaultValue={bundle.filters.subjectType} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="ALL">すべて</option>
                <option value="EMPLOYEE">社員</option>
                <option value="PARTNER">パートナー</option>
              </select>
            </label>
            <label className="text-sm text-white">
              所属状態
              <select name="membershipFilter" defaultValue={bundle.filters.membershipFilter} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="ALL">すべて</option>
                <option value="ASSIGNED">所属あり</option>
                <option value="UNASSIGNED">未所属</option>
              </select>
            </label>
            <label className="text-sm text-white">
              名前検索
              <input name="keyword" defaultValue={bundle.filters.keyword} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none" placeholder="氏名・社員No・会社名" />
            </label>
            <button type="submit" className="xl:col-span-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
              検索
            </button>
          </form>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-8">
          {[
            ["売上", bundle.totals.salesTotal],
            ["人件費", bundle.totals.directLaborCost],
            ["外注費", bundle.totals.outsourcingCost],
            ["チーム経費按分", bundle.totals.indirectCostAllocation],
            ["全社固定費按分", bundle.totals.fixedCostAllocation],
            ["最終粗利", bundle.totals.finalGrossProfit],
            ["その他コスト", bundle.totals.otherCostTotal],
            ["調整後最終粗利", bundle.totals.adjustedFinalGrossProfit],
          ].map(([label, value]) => (
            <article key={label} className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
              <p className="text-sm text-stone-500">{label}</p>
              <p className="mt-2 text-lg font-semibold leading-tight text-stone-950 xl:text-xl">{formatCurrencyWithUnit(Number(value))}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">一覧</h2>
            <p className="text-sm text-stone-500">{bundle.rows.length} 件</p>
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200">
            <table className="min-w-[1400px] text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium">区分</th>
                  <th className="px-4 py-3 font-medium">名称</th>
                  <th className="px-4 py-3 font-medium">社員No./所属</th>
                  <th className="px-4 py-3 font-medium">部署</th>
                  <th className="px-4 py-3 font-medium">チーム</th>
                  <th className="px-4 py-3 font-medium">所属状態</th>
                  <th className="px-4 py-3 font-medium">売上</th>
                  <th className="px-4 py-3 font-medium">人件費</th>
                  <th className="px-4 py-3 font-medium">外注費</th>
                  <th className="px-4 py-3 font-medium">チーム経費按分</th>
                  <th className="px-4 py-3 font-medium">全社固定費按分</th>
                  <th className="px-4 py-3 font-medium">最終粗利</th>
                  <th className="px-4 py-3 font-medium">粗利率</th>
                </tr>
              </thead>
              <tbody>
                {bundle.rows.map((row) => (
                  <tr key={row.key} className="border-t border-stone-200">
                    <td className="px-4 py-3 font-medium text-stone-950">{row.subjectType === "EMPLOYEE" ? "社員" : "パートナー"}</td>
                    <td className="px-4 py-3 text-stone-900">{row.displayName}</td>
                    <td className="px-4 py-3 text-stone-700">{row.secondaryLabel || "-"}</td>
                    <td className="px-4 py-3 text-stone-700">{row.departmentName || "-"}</td>
                    <td className="px-4 py-3 text-stone-700">{row.teamName || "-"}</td>
                    <td className="px-4 py-3 text-stone-700">
                      {row.membershipStatus === "PARTNER" ? "-" : row.membershipStatus === "UNASSIGNED" ? "未所属" : "所属あり"}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{formatCurrencyWithUnit(row.salesTotal)}</td>
                    <td className="px-4 py-3 text-stone-700">{formatCurrencyWithUnit(row.directLaborCost)}</td>
                    <td className="px-4 py-3 text-stone-700">{formatCurrencyWithUnit(row.outsourcingCost)}</td>
                    <td className="px-4 py-3 text-stone-700">{formatCurrencyWithUnit(row.indirectCostAllocation)}</td>
                    <td className="px-4 py-3 text-stone-700">{formatCurrencyWithUnit(row.fixedCostAllocation)}</td>
                    <td className={`px-4 py-3 font-semibold ${row.finalGrossProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCurrencyWithUnit(row.finalGrossProfit)}</td>
                    <td className={`px-4 py-3 font-semibold ${row.grossProfitRate >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{row.grossProfitRate}%</td>
                  </tr>
                ))}
                {bundle.rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-10 text-center text-stone-500">条件に一致するデータがありません。</td>
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
