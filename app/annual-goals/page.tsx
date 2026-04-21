import Link from "next/link";

import { AnnualGoalList } from "@/components/annual-goals/annual-goal-list";
import { getAnnualGoalListBundle } from "@/lib/annual-goals/service";
import { getSessionUser } from "@/lib/auth/demo-session";

type AnnualGoalListPageProps = Readonly<{
  searchParams: Promise<{
    fiscalYear?: string;
    goalType?: string;
    targetKeyword?: string;
    priorityKeyword?: string;
    grossProfitStatus?: string;
  }>;
}>;

function buildGoalTypeHref(
  filters: {
    fiscalYear: string;
    goalType: string;
    targetKeyword: string;
    priorityKeyword: string;
    grossProfitStatus: string;
  },
  goalType: string,
) {
  const params = new URLSearchParams();

  if (filters.fiscalYear) {
    params.set("fiscalYear", filters.fiscalYear);
  }
  if (filters.targetKeyword) {
    params.set("targetKeyword", filters.targetKeyword);
  }
  if (filters.priorityKeyword) {
    params.set("priorityKeyword", filters.priorityKeyword);
  }
  if (filters.grossProfitStatus) {
    params.set("grossProfitStatus", filters.grossProfitStatus);
  }
  if (goalType) {
    params.set("goalType", goalType);
  }

  const query = params.toString();
  return query ? `/annual-goals?${query}` : "/annual-goals";
}

export default async function AnnualGoalListPage({ searchParams }: AnnualGoalListPageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  const bundle = await getAnnualGoalListBundle(user, params);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Annual Goals</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">年度目標一覧</h1>
              <p className="mt-2 text-sm text-slate-300">粗利達成状況と重点テーマを起点に、チームまたは個人の年度目標を確認します。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/annual-goals/create" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                新規作成
              </Link>
              <Link href="/monthly-report" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月報メニューへ
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "", label: "すべて" },
              { key: "team", label: "チーム" },
              { key: "personal", label: "個人" },
            ].map((tab) => {
              const isActive = bundle.filters.goalType === tab.key || (!bundle.filters.goalType && tab.key === "");
              return (
                <Link
                  key={tab.key || "all"}
                  href={buildGoalTypeHref(bundle.filters, tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-950 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            個人タブでは、ユーザー設定で月報表示にチェックがあるユーザーのみ対象です。
          </p>
          <form className="mt-6 grid gap-4 lg:grid-cols-[150px_1fr_1fr_150px_auto] lg:items-end">
            <input type="hidden" name="goalType" value={bundle.filters.goalType} />
            <label className="text-sm text-slate-700">
              年度
              <input name="fiscalYear" defaultValue={bundle.filters.fiscalYear} placeholder="2026" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
            </label>
            <label className="text-sm text-slate-700">
              対象名
              <input name="targetKeyword" defaultValue={bundle.filters.targetKeyword} placeholder="チーム名または氏名" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
            </label>
            <label className="text-sm text-slate-700">
              優先テーマ
              <input name="priorityKeyword" defaultValue={bundle.filters.priorityKeyword} placeholder="優先テーマで絞り込み" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
            </label>
            <label className="text-sm text-slate-700">
              粗利判定
              <select name="grossProfitStatus" defaultValue={bundle.filters.grossProfitStatus} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="">すべて</option>
                <option value="achieved">達成</option>
                <option value="under">未達</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">絞り込む</button>
              <Link href="/annual-goals" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">クリア</Link>
            </div>
          </form>
          <p className="mt-4 text-sm text-slate-500">{bundle.rows.length} 件表示中</p>
        </section>

        <div className="mt-8">
          <AnnualGoalList bundle={bundle} />
        </div>
      </div>
    </main>
  );
}
