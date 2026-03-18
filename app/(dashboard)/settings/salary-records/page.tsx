import Link from "next/link";

import { SalaryRecordEditor } from "@/components/settings/salary-record-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSalaryRecordBundle } from "@/lib/salary/salary-record-service";

export default async function SalaryRecordsPage() {
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

  const bundle = await getSalaryRecordBundle("2026-03");

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Employee Cost</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">社員コスト設定</h1>
              <p className="mt-2 text-sm text-slate-300">2026-03 時点で有効な給与・社保・固定費を設定し、月次PLの人件費へ自動反映します。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                ダッシュボードへ
              </Link>
              <Link href="/pl/monthly" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月次PLへ
              </Link>
              <Link href="/settings/rates" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                売上
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <SalaryRecordEditor yearMonth={bundle.yearMonth} canEdit={canEdit} defaults={bundle.rows} />
        </div>
      </div>
    </main>
  );
}



