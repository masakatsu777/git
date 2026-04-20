import Link from "next/link";

export default function MonthlyReportMenuPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Monthly Report</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">月報メニュー</h1>
              <p className="mt-2 text-sm text-slate-300">
                月報作成と年度目標の入口です。年度目標はこれから設計を進める前提で、まずはメニュー構成を整えています。
              </p>
            </div>
            <Link href="/menu" className="w-fit rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
              メニューへ戻る
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Monthly Report</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">月報作成</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              年月とプロジェクトを選び、チーム課題・実践結果と個人の役割、成長課題、実践結果を入力します。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/monthly-report/create"
                className="inline-flex rounded-full bg-brand-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-brand-300"
              >
                月報作成へ進む
              </Link>
              <Link
                href="/monthly-report/list"
                className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                月報一覧を見る
              </Link>
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Annual Goal</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">年度目標</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              粗利達成状況と評価結果をもとに、今年度の重点テーマと目標を設定します。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/annual-goals" className="inline-flex rounded-full bg-brand-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-brand-300">
                年度目標へ進む
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
