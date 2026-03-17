import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { filterEmployees, getFilterOptions, sortGrowthRecords } from "@/lib/employee-data";
import { getCurrentEmployee, getCurrentViewer, getVisibleEmployees } from "@/lib/viewer-context";
import { getUiSettings } from "@/lib/ui-settings";

type GrowthRecordsPageProps = Readonly<{
  searchParams: Promise<{
    q?: string;
    role?: string;
    tone?: string;
    sort?: string;
  }>;
}>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export default async function GrowthRecordsPage({ searchParams }: GrowthRecordsPageProps) {
  const params = await searchParams;
  const viewer = await getCurrentViewer();
  const currentEmployee = await getCurrentEmployee();
  const visibleEmployees = await getVisibleEmployees();
  const filteredEmployees = sortGrowthRecords(
    filterEmployees(visibleEmployees, {
      q: params.q,
      role: params.role,
      tone: params.tone,
    }),
    (params.sort as "priority" | "name" | "role") ?? "priority",
  );
  const options = getFilterOptions(visibleEmployees);
  const ui = await getUiSettings();

  const pageTitle =
    viewer.role === "employee"
      ? `自分の${ui.growthRecordsLabel}`
      : viewer.role === "leader"
        ? `メンバーの${ui.growthRecordsLabel}`
        : `全体の${ui.growthRecordsLabel}`;

  const pageDescription =
    viewer.role === "employee"
      ? `自分のふりかえり、成長テーマ、次に試したい行動を整理するための${ui.growthRecordsLabel}です。`
      : viewer.role === "leader"
        ? `${currentEmployee?.team ?? "チーム"} のメンバーがどんなテーマで取り組んでいるかを見渡し、支援につなげるための${ui.growthRecordsLabel}です。`
        : `部門や役割をまたいで、成長テーマと進捗の流れを俯瞰するための${ui.growthRecordsLabel}です。`;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,#081122_100%)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand-200">Growth Records</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">{pageTitle}</h1>
            <p className="mt-4 max-w-3xl text-slate-300">{pageDescription}</p>
          </div>
          <Link
            href="/one-on-one"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-300/40 hover:text-white"
          >
            {ui.oneOnOneLabel}を見る
          </Link>
        </div>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <form className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_auto] lg:items-end">
            <label className="block">
              <span className="text-sm text-slate-300">キーワード</span>
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="氏名、テーマ、次の一歩で検索"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            {visibleEmployees.length > 1 ? (
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
            ) : (
              <input type="hidden" name="role" value="all" />
            )}

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
                <option value="priority">要フォロー順</option>
                <option value="name">氏名順</option>
                <option value="role">役割順</option>
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
                href="/growth-records"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-300/40 hover:text-white"
              >
                クリア
              </Link>
            </div>
          </form>

          <p className="mt-4 text-sm text-slate-400">{filteredEmployees.length} 件表示中</p>
        </section>

        <div className="mt-10 grid gap-4">
          {filteredEmployees.length > 0 ? (
            filteredEmployees.map((employee, index) => (
              <section
                key={employee.id}
                className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-white">
                        {viewer.role === "employee" ? `今月の自分の${ui.growthRecordsLabel}` : employee.name}
                      </p>
                      {params.sort === "priority" || !params.sort ? (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                          優先 {index + 1}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-300">成長テーマ: {employee.theme}</p>
                    <p className="mt-2 text-sm text-slate-400">次の一歩: {employee.nextAction}</p>
                  </div>
                  <span className="rounded-full border border-brand-300/30 bg-brand-400/10 px-3 py-1 text-xs font-medium text-brand-200">
                    {employee.tone}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
                    未更新: {employee.lastUpdatedDaysAgo}日
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
                    次回1on1予定: {formatDate(employee.nextOneOnOneDate)}
                  </div>
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/5 p-10 text-center text-slate-300">
              条件に合う記録が見つかりませんでした。検索条件をゆるめて再度お試しください。
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
