import Link from "next/link";

import { SalaryRecordEditor } from "@/components/settings/salary-record-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getVisibleYearMonthOptions } from "@/lib/pl/service";
import { getSalaryRecordBundle } from "@/lib/salary/salary-record-service";

export default async function SalaryRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ yearMonth?: string }>;
}) {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.salaryRead);
  const canEdit = hasPermission(user, PERMISSIONS.salaryWrite);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">社員コスト設定</h1>
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

  const params = await searchParams;
  const yearMonthOptions = await getVisibleYearMonthOptions();
  const selectedYearMonth = params.yearMonth ?? yearMonthOptions[0]?.yearMonth ?? "2026-03";
  const bundle = await getSalaryRecordBundle(selectedYearMonth);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Employee Cost</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">社員コスト設定</h1>
              <p className="mt-2 text-sm text-slate-300">{bundle.yearMonth} 月末時点で有効な給与・社保・固定費を表示します。適用開始日の履歴を持ち、対象月に有効な最新レコードが月次PLの人件費へ反映されます。</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <form method="get" className="flex flex-wrap items-end gap-3">
                <label className="text-sm text-slate-200">
                  表示月
                  <select
                    name="yearMonth"
                    defaultValue={bundle.yearMonth}
                    className="mt-2 min-w-44 rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                  >
                    {yearMonthOptions.map((option) => (
                      <option key={option.yearMonth} value={option.yearMonth}>
                        {option.yearMonth}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="rounded-full bg-brand-200 px-4 py-2 text-sm font-medium text-slate-950">
                  月切替
                </button>
              </form>
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                ダッシュボードへ
              </Link>
              <Link href="/pl/monthly" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月次PLへ
              </Link>
              <Link href="/settings/monthly-labor-adjustments" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                変動人件費
              </Link>
              <Link href="/settings/rates" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                単価
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <SalaryRecordEditor key={bundle.yearMonth} yearMonth={bundle.yearMonth} canEdit={canEdit} defaults={bundle.rows} />
        </div>
      </div>
    </main>
  );
}
