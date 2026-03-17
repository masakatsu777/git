import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentViewer, canViewEmployeeDetail } from "@/lib/viewer-context";
import { getEmployeeRecordByCode } from "@/lib/server/employee-records";

type EmployeeDetailPageProps = Readonly<{
  params: Promise<{
    employeeId: string;
  }>;
}>;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDelta(value: number) {
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("ja-JP").format(value)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { employeeId } = await params;
  const employee = await getEmployeeRecordByCode(employeeId);
  const viewer = await getCurrentViewer();
  const canView = await canViewEmployeeDetail(employeeId);

  if (!employee || !canView) {
    notFound();
  }

  const salesGap = employee.teamSummary.sales - employee.teamSummary.salesTarget;
  const grossProfitGap = employee.teamSummary.grossProfit - employee.teamSummary.grossProfitTarget;
  const grossProfitRateGap = employee.teamSummary.grossProfitRate - employee.teamSummary.grossProfitRateTarget;
  const canSeeFinancialDetails = viewer.role !== "employee";
  const pageTitle = viewer.role === "employee" ? "自分の詳細" : "社員詳細";
  const pageDescription =
    viewer.role === "employee"
      ? `${employee.department} / ${employee.team} に所属する自分の成長テーマと、チームの状況サマリーを確認できます。`
      : `${employee.department} / ${employee.team} に所属する ${employee.role} の詳細です。個人の成長テーマと、所属チームの数値状況を一緒に見られる形にしています。`;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,#081122_100%)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand-200">Employee Detail</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">{pageTitle}</h1>
            <p className="mt-4 max-w-3xl text-slate-300">{pageDescription}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/employees"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-300/40 hover:text-white"
            >
              一覧へ戻る
            </Link>
            <Link
              href="/one-on-one"
              className="rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-400"
            >
              1on1サポートへ
            </Link>
          </div>
        </div>

        <section className="mt-10 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{employee.id}</span>
              <span className="rounded-full border border-brand-300/30 bg-brand-400/10 px-3 py-1 text-xs font-medium text-brand-200">
                {employee.tone}
              </span>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Growth Theme</p>
                <p className="mt-3 text-base leading-8 text-slate-100">{employee.theme}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Next Action</p>
                <p className="mt-3 text-base leading-8 text-slate-100">{employee.nextAction}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Recent Note</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{employee.recentNote}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
                未更新: {employee.lastUpdatedDaysAgo}日
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
                次回1on1予定: {formatDate(employee.nextOneOnOneDate)}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {employee.focus.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Team Summary</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{employee.team} の状況</h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {employee.teamSummary.yearMonth}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">売上</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(employee.teamSummary.sales)}</p>
                <p className="mt-2 text-sm text-slate-300">目標差分 {formatDelta(salesGap)} 円</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">粗利</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(employee.teamSummary.grossProfit)}</p>
                <p className="mt-2 text-sm text-slate-300">目標差分 {formatDelta(grossProfitGap)} 円</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">粗利率</p>
                <p className="mt-3 text-2xl font-semibold text-white">{employee.teamSummary.grossProfitRate}%</p>
                <p className="mt-2 text-sm text-slate-300">目標差分 {grossProfitRateGap.toFixed(1)} pt</p>
              </div>
            </div>

            {canSeeFinancialDetails ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-200">コスト内訳</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-4">
                      <span>直接原価</span>
                      <span className="text-slate-100">{formatCurrency(employee.teamSummary.directCost)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>間接費</span>
                      <span className="text-slate-100">{formatCurrency(employee.teamSummary.indirectCost)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>固定費配賦</span>
                      <span className="text-slate-100">{formatCurrency(employee.teamSummary.fixedCostAllocation)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                      <span>合計コスト</span>
                      <span className="text-slate-100">{formatCurrency(employee.teamSummary.totalCost)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-200">チーム構成</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-4">
                      <span>所属メンバー</span>
                      <span className="text-slate-100">{employee.teamSummary.teamMembers} 名</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>協力会社</span>
                      <span className="text-slate-100">{employee.teamSummary.partners} 社</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>売上目標</span>
                      <span className="text-slate-100">{formatCurrency(employee.teamSummary.salesTarget)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>粗利目標</span>
                      <span className="text-slate-100">{formatCurrency(employee.teamSummary.grossProfitTarget)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">チームの見え方</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  社員向けには、所属チームの流れをつかみやすい主要指標だけを表示しています。詳細な原価内訳や配賦情報は、リーダー・管理者向け画面で確認できます。
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    所属メンバー: {employee.teamSummary.teamMembers} 名
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    協力会社: {employee.teamSummary.partners} 社
                  </div>
                </div>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
