import Link from "next/link";

import { MonthlyReportForm } from "@/components/monthly-reports/monthly-report-form";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getMonthlyReportEditorBundle } from "@/lib/monthly-reports/service";

type MonthlyReportPageProps = Readonly<{
  searchParams: Promise<{
    yearMonth?: string;
    projectId?: string;
  }>;
}>;

export default async function MonthlyReportPage({ searchParams }: MonthlyReportPageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  const bundle = await getMonthlyReportEditorBundle(user, params);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Monthly Report</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">月報作成</h1>
              <p className="mt-2 text-sm text-slate-300">プロジェクト単位で、チームと個人の取り組みを月ごとに記録します。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/monthly-report/list" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月報一覧へ
              </Link>
              <Link href="/menu" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                メニューへ戻る
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <MonthlyReportForm initialBundle={bundle} />
        </div>
      </div>
    </main>
  );
}
