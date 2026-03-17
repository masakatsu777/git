import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentEmployee, getCurrentViewer, getVisibleEmployees } from "@/lib/viewer-context";
import { getUiSettings } from "@/lib/ui-settings";

const employeeSupportItems = [
  "前回1on1で決めた行動をふりかえる",
  "最近できたことを言語化する",
  "次の30日で試したいことを決める",
];

const leaderSupportItems = [
  "メンバーごとの成長テーマを見比べる",
  "支援が必要なポイントを整理する",
  "次回1on1で扱う問いを準備する",
];

const adminSupportItems = [
  "全体の対話テーマの偏りを確認する",
  "テンプレートや運用の改善点を拾う",
  "支援フローの共通化ポイントを整理する",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export default async function OneOnOnePage() {
  const viewer = await getCurrentViewer();
  const currentEmployee = await getCurrentEmployee();
  const visibleEmployees = await getVisibleEmployees();
  const ui = await getUiSettings();

  const supportItems =
    viewer.role === "employee"
      ? employeeSupportItems
      : viewer.role === "leader"
        ? leaderSupportItems
        : adminSupportItems;

  const pageTitle =
    viewer.role === "employee"
      ? `自分の${ui.oneOnOneLabel}`
      : viewer.role === "leader"
        ? ui.oneOnOneLabel
        : "対話支援の整理";

  const pageDescription =
    viewer.role === "employee"
      ? `上司との対話に向けて、自分の振り返りや相談したいことを準備するための${ui.oneOnOneLabel}です。`
      : viewer.role === "leader"
        ? `${currentEmployee?.team ?? "チーム"} のメンバーとの対話を、成長支援として進めるための${ui.oneOnOneLabel}です。`
        : `全体の1on1運用を見直し、より安心して対話できる流れを整えるための${ui.oneOnOneLabel}です。`;

  const flowItems =
    viewer.role === "employee"
      ? ["最近できたことを整理する", "相談したいことを一つ決める", "次の一歩を言葉にする"]
      : viewer.role === "leader"
        ? ["できたことを一緒に確認する", "つまずいた点を言葉にする", "次に試す行動を一緒に決める"]
        : ["運用の詰まりを把握する", "現場の声を整理する", "テンプレート改善へつなげる"];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,#081122_100%)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand-200">One on One</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">{pageTitle}</h1>
            <p className="mt-4 text-slate-300">{pageDescription}</p>

            <ul className="mt-8 space-y-3 text-sm text-slate-200">
              {supportItems.map((item) => (
                <li key={item} className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 space-y-4">
              {visibleEmployees.map((employee) => (
                <div key={employee.id} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">
                      {viewer.role === "employee" ? "自分の準備状況" : employee.name}
                    </p>
                    <span className="rounded-full border border-brand-300/30 bg-brand-400/10 px-3 py-1 text-xs font-medium text-brand-200">
                      {employee.tone}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      次回1on1予定: {formatDate(employee.nextOneOnOneDate)}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      未更新: {employee.lastUpdatedDaysAgo}日
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">準備ポイント: {employee.nextAction}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-8 backdrop-blur">
            <p className="text-sm font-medium text-brand-200">おすすめの流れ</p>
            <div className="mt-5 space-y-4 text-sm text-slate-300">
              {flowItems.map((item, index) => (
                <p key={item}>{index + 1}. {item}</p>
              ))}
            </div>

            {viewer.role !== "employee" ? (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">対象者</p>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  {visibleEmployees.map((employee) => (
                    <p key={employee.id}>{employee.name}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <Link
              href="/growth-records"
              className="mt-8 inline-flex rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-400"
            >
              {ui.growthRecordsLabel}へ戻る
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
