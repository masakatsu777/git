import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { filterEmployees, getFilterOptions, sortEmployees } from "@/lib/employee-data";
import { getEmployeesPageContent, getVisibleEmployees } from "@/lib/viewer-context";

type EmployeesPageProps = Readonly<{
  searchParams: Promise<{
    q?: string;
    role?: string;
    team?: string;
    tone?: string;
    sort?: string;
  }>;
}>;

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const params = await searchParams;
  const employees = await getVisibleEmployees();
  const pageContent = await getEmployeesPageContent();
  const filteredEmployees = sortEmployees(filterEmployees(employees, params), (params.sort as "priority" | "name" | "role" | "team") ?? "priority");
  const options = getFilterOptions(employees);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,#081122_100%)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand-200">Employees</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">{pageContent.pageTitle}</h1>
            <p className="mt-4 max-w-2xl text-slate-300">{pageContent.pageDescription}</p>
          </div>
          <Link
            href="/growth-records"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-300/40 hover:text-white"
          >
            {pageContent.ctaLabel}
          </Link>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <form className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr_0.9fr_0.9fr_0.9fr_auto] lg:items-end">
            <label className="block">
              <span className="text-sm text-slate-300">キーワード</span>
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="氏名、ID、テーマで検索"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">役割</span>
              <select
                name="role"
                defaultValue={params.role ?? "all"}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="all">すべて</option>
                {options.roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">チーム</span>
              <select
                name="team"
                defaultValue={params.team ?? "all"}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="all">すべて</option>
                {options.teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">状況</span>
              <select
                name="tone"
                defaultValue={params.tone ?? "all"}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="all">すべて</option>
                {options.tones.map((tone) => (
                  <option key={tone} value={tone}>
                    {tone}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">並び順</span>
              <select
                name="sort"
                defaultValue={params.sort ?? "priority"}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="priority">更新優先順</option>
                <option value="name">氏名順</option>
                <option value="role">役割順</option>
                <option value="team">チーム順</option>
              </select>
            </label>

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-400"
              >
                絞り込む
              </button>
              <Link
                href="/employees"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-300/40 hover:text-white"
              >
                クリア
              </Link>
            </div>
          </form>

          <p className="mt-4 text-sm text-slate-400">{filteredEmployees.length} 件表示中</p>
        </section>

        <section className="mt-8 grid gap-4">
          {filteredEmployees.length > 0 ? (
            filteredEmployees.map((employee) => (
              <article
                key={employee.id}
                className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold text-white">{employee.name}</h2>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                        {employee.id}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      {employee.role} / {employee.team}
                    </p>
                  </div>
                  <span className="rounded-full border border-brand-300/30 bg-brand-400/10 px-3 py-1 text-xs font-medium text-brand-200">
                    {employee.tone}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Growth Theme</p>
                    <p className="mt-3 text-sm leading-7 text-slate-200">{employee.theme}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Next Action</p>
                    <p className="mt-3 text-sm leading-7 text-slate-200">{employee.nextAction}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/employees/${employee.id}`}
                    className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
                  >
                    {filteredEmployees.length === 1 && employees.length === 1 ? "自分の詳細を見る" : "社員詳細を見る"}
                  </Link>
                  <Link
                    href="/one-on-one"
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-300/40 hover:text-white"
                  >
                    1on1サポートへ
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/5 p-10 text-center text-slate-300">
              条件に合う社員が見つかりませんでした。検索条件をゆるめて再度お試しください。
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
