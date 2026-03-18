import Link from "next/link";

import { RateSettingEditor } from "@/components/settings/rate-setting-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getRateSettingsBundle } from "@/lib/rates/rate-setting-service";

export default async function RateSettingsPage() {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.masterWrite);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">単価・外注費基準値設定</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
            <div className="mt-6">
              <Link href="/dashboard" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                ダッシュボードへ戻る
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const bundle = await getRateSettingsBundle();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Sales Settings</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">単価・外注費基準値設定</h1>
              <p className="mt-2 text-sm text-slate-300">社員売上単価、パートナー売上単価、標準外注費を管理します。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                ダッシュボードへ
              </Link>
              <Link href="/pl/monthly" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月次PLへ
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <RateSettingEditor canEdit={canView} employeeDefaults={bundle.employeeRates} partnerDefaults={bundle.partnerRates} />
        </div>
      </div>
    </main>
  );
}


