import { SiteHeader } from "@/components/site-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getUiSettings } from "@/lib/ui-settings";
import { getCurrentViewer } from "@/lib/viewer-context";

export default async function SettingsPage() {
  const viewer = await getCurrentViewer();
  const uiSettings = await getUiSettings();
  const isAdmin = viewer.role === "admin";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,#081122_100%)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand-200">Settings</p>
              <h1 className="mt-4 text-4xl font-semibold text-white">環境設定</h1>
              <p className="mt-4 max-w-2xl text-slate-300">
                画面名称やテンプレート文言を調整して、運用に合った空気感へ寄せていくための設定画面です。
              </p>
            </div>
            <span
              className={
                isAdmin
                  ? "rounded-full border border-brand-300/30 bg-brand-400/10 px-4 py-2 text-sm font-medium text-brand-100"
                  : "rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300"
              }
            >
              {isAdmin ? "管理者として編集中" : "プレビュー中: 閲覧専用"}
            </span>
          </div>

          <div className="mt-8">
            <SettingsForm initialSettings={uiSettings} canEdit={isAdmin} />
          </div>
        </section>
      </main>
    </div>
  );
}
