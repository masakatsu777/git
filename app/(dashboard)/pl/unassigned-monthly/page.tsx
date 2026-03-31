import Link from "next/link";

import { DepartmentUnassignedSalesEditor } from "@/components/pl/department-unassigned-sales-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getDepartmentUnassignedSalesBundle } from "@/lib/pl/department-unassigned-sales-service";

export default async function DepartmentUnassignedMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; yearMonth?: string }>;
}) {
  const user = await getSessionUser();
  const canEdit = user.role === "admin" || user.role === "president";

  if (!canEdit) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf7_0%,#f7f2e8_100%)] px-6 py-16 text-stone-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-10 shadow-[0_18px_50px_rgba(41,37,36,0.08)]">
          <h1 className="text-3xl font-semibold">部署未所属売上入力</h1>
          <p className="mt-3 text-stone-600">この画面は管理者または役員向けです。</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">
            月次ダッシュボードへ戻る
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const bundle = await getDepartmentUnassignedSalesBundle(params.departmentId, params.yearMonth, { includeOptions: true });

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf7_0%,#f7f2e8_100%)] text-stone-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-stone-950 px-8 py-7 text-stone-50 shadow-[0_30px_80px_rgba(41,37,36,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-amber-200">Department Unassigned Sales</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">部署未所属売上入力</h1>
              <p className="mt-2 text-sm text-stone-300">{bundle.departmentName} / {bundle.yearMonth} / source: {bundle.source}</p>
              <p className="mt-2 text-sm text-stone-400">チーム未所属の社員・パートナー売上を部署単位で管理します。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月次ダッシュボードへ
              </Link>
              <Link href={`/pl/annual-personal?departmentId=${bundle.departmentId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                個人年度ダッシュボードへ
              </Link>
            </div>
          </div>
          <form method="get" className="mt-5 grid gap-4 rounded-[1.5rem] bg-white/10 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm text-stone-200">
              部署
              <select name="departmentId" defaultValue={bundle.departmentId} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.departmentOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-stone-200">
              表示月
              <select name="yearMonth" defaultValue={bundle.yearMonth} className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none">
                {bundle.yearMonthOptions.map((option) => (
                  <option key={option.yearMonth} value={option.yearMonth}>{option.yearMonth}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-stone-950">
              表示更新
            </button>
          </form>
        </header>

        <section className="mt-8">
          <DepartmentUnassignedSalesEditor
            key={JSON.stringify({ departmentId: bundle.departmentId, yearMonth: bundle.yearMonth, assignments: bundle.assignments })}
            departmentId={bundle.departmentId}
            yearMonth={bundle.yearMonth}
            canEdit={canEdit}
            employeeOptions={bundle.employeeOptions}
            partnerOptions={bundle.partnerOptions}
            defaults={bundle.assignments.map((row) => ({
              id: row.id,
              targetType: row.targetType,
              userId: row.userId,
              partnerId: row.partnerId,
              partnerName: row.label,
              unitPrice: row.unitPrice,
              salesAmount: row.salesAmount,
              outsourcingCost: row.outsourcingCost,
              workRate: row.workRate,
              remarks: row.remarks,
            }))}
          />
        </section>
      </div>
    </main>
  );
}
