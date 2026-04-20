import Link from "next/link";

import { MonthlyReportList } from "@/components/monthly-reports/monthly-report-list";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getMonthlyReportListBundle } from "@/lib/monthly-reports/service";

type MonthlyReportListPageProps = Readonly<{
  searchParams: Promise<{
    yearMonth?: string;
    projectKeyword?: string;
    teamKeyword?: string;
    userKeyword?: string;
  }>;
}>;

export default async function MonthlyReportListPage({ searchParams }: MonthlyReportListPageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  const bundle = await getMonthlyReportListBundle(user, params);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Monthly Reports</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">月報一覧</h1>
              <p className="mt-2 text-sm text-slate-300">年月、プロジェクト、チーム単位で開いて、チーム内容と個人内容を順に確認できます。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/monthly-report" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月報作成へ
              </Link>
              <Link href="/menu" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                メニューへ戻る
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <form className="grid gap-4 lg:grid-cols-[180px_1fr_220px_220px_auto] lg:items-end">
            <label className="text-sm text-slate-700">
              年月
              <input
                type="month"
                name="yearMonth"
                defaultValue={bundle.filters.yearMonth}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              プロジェクト
              <input
                name="projectKeyword"
                defaultValue={bundle.filters.projectKeyword}
                placeholder="プロジェクト名で絞り込み"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              チーム名
              <input
                name="teamKeyword"
                defaultValue={bundle.filters.teamKeyword}
                placeholder="例: プラットフォーム"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              氏名
              <input
                name="userKeyword"
                defaultValue={bundle.filters.userKeyword}
                placeholder="氏名で絞り込み"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <div className="flex gap-3">
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                絞り込む
              </button>
              <Link href="/monthly-report/list" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                クリア
              </Link>
            </div>
          </form>
          <p className="mt-4 text-sm text-slate-500">{bundle.groups.length} 件表示中</p>
        </section>

        <div className="mt-8">
          <MonthlyReportList groups={bundle.groups} />
        </div>
      </div>
    </main>
  );
}
