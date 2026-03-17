import Link from "next/link";

import { PreflightChecklist } from "@/components/operations/preflight-checklist";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

export default async function PreflightChecklistPage() {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.masterWrite) || hasPermission(user, PERMISSIONS.salaryApprove);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">本番前チェックリスト</h1>
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
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Preflight Checklist</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">本番前チェックリスト</h1>
              <p className="mt-2 text-sm text-slate-300">最終確認項目をアプリ内で進められるようにしています。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/operations/preflight" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">本番前チェック</Link>
              <Link href="/dashboard" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">ダッシュボード</Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <PreflightChecklist />
        </div>
      </div>
    </main>
  );
}
