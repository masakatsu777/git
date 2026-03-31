import Link from "next/link";

import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

const sections = [
  {
    title: "環境準備",
    items: [
      { label: "本番前チェックリスト", href: "/operations/preflight/checklist", note: "アプリ内で最終確認を進める" },
      { label: "環境準備に進む", href: "/settings/organization", note: "組織、ユーザー、制度値の整備へ進む" },
    ],
  },
  {
    title: "制度設定",
    items: [
      { label: "評価制度設定", href: "/settings/skill-careers", note: "項目、重み、根拠必須を確認" },
    ],
  },
  {
    title: "評価フロー",
    items: [
      { label: "自己評価", href: "/evaluations/my", note: "自律成長力と協調相乗力の入力確認" },
      { label: "上長評価", href: "/evaluations/team", note: "根拠の再表示を確認" },
      { label: "最終評価", href: "/evaluations/finalize", note: "達成率、実施率、総合等級を確認" },
    ],
  },
  {
    title: "昇給運用",
    items: [
      { label: "昇給決定", href: "/salary/simulations", note: "決定額、差額、調整理由、承認を確認" },
      { label: "監査ログ", href: "/settings/audit-logs?action=SALARY_SIMULATION", note: "保存、承認、反映ログを確認" },
    ],
  },
  {
    title: "収益確認",
    items: [
      { label: "月次ダッシュボード", href: "/dashboard", note: "当月の差異を確認" },
      { label: "月次PL", href: "/pl/monthly", note: "粗利目標率と実績を確認" },
      { label: "年度ダッシュボード", href: "/pl/annual", note: "年度集計と評価サマリーを確認" },
    ],
  },
];

export default async function PreflightPage() {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.masterWrite) || hasPermission(user, PERMISSIONS.salaryApprove);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">本番前チェック</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Preflight</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">本番前チェック</h1>
              <p className="mt-2 text-sm text-slate-300">最終確認に使う主要画面へ、そのまま移動できます。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">ダッシュボード</Link>
              <Link href="/operations/preflight/checklist" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">チェックリスト</Link>
            </div>
          </div>
        </header>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.items.map((item) => (
                  <Link key={item.href + item.label} href={item.href} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-5 py-4 transition hover:border-slate-300 hover:bg-white">
                    <p className="font-semibold text-slate-950">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
