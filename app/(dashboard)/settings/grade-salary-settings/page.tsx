import Link from "next/link";

import { GradeSalarySettingEditor } from "@/components/settings/grade-salary-setting-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getGradeSalarySettingBundle } from "@/lib/grade-salary/grade-salary-setting-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

export default async function GradeSalarySettingsPage() {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.masterWrite);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">等級・給与計算設定</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
            <div className="mt-6">
              <Link href="/dashboard" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">ダッシュボードへ戻る</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const defaults = await getGradeSalarySettingBundle();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Grade Salary Settings</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">等級・給与計算設定</h1>
              <p className="mt-2 text-sm text-slate-300">S / B / G 点数と、ベース金額 + 等級計算金額 の給与計算ルールを管理します。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/settings/skill-careers" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">評価制度設定</Link>
              <Link href="/salary/results" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">昇給結果</Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <GradeSalarySettingEditor canEdit={canView} defaults={defaults} />
        </div>
      </div>
    </main>
  );
}
