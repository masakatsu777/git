import Link from "next/link";
import { redirect } from "next/navigation";

import { SelfReviewEditor } from "@/components/evaluations/self-review-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getEvaluationPeriodOptions, getEvaluationPeriodStatusLabel } from "@/lib/evaluations/period-service";
import { getSelfReviewBundle } from "@/lib/evaluations/self-review-service";
import { isUserMenuEnabled } from "@/lib/menu-visibility/menu-visibility-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

export default async function MyEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ evaluationPeriodId?: string }>;
}) {
  const user = await getSessionUser();
  const philosophyPracticeEnabled = await isUserMenuEnabled(user.id, "philosophyPractice", user.role);
  const params = await searchParams;

  if (!philosophyPracticeEnabled) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">理念実践管理の対象外です</h1>
          <p className="mt-3 text-sm text-slate-600">この機能は現在のメニュー設定では利用対象外です。必要に応じて管理者へご相談ください。</p>
        </div>
      </main>
    );
  }
  const periods = await getEvaluationPeriodOptions();
  const selectedEvaluationPeriodId = params.evaluationPeriodId ?? periods[0]?.id;

  if (!params.evaluationPeriodId && selectedEvaluationPeriodId) {
    redirect(`/evaluations/my?evaluationPeriodId=${selectedEvaluationPeriodId}`);
  }

  const bundle = await getSelfReviewBundle(user.id, user.role, selectedEvaluationPeriodId);
  const canEdit = hasPermission(user, PERMISSIONS.evaluationSelfWrite) && bundle.periodStatus === "OPEN";
  const periodStatusLabel = getEvaluationPeriodStatusLabel(bundle.periodStatus);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Self Review</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">自己評価</h1>
              <p className="mt-2 text-sm text-slate-300">{user.name} の自己評価入力画面です。評価期間を切り替えると過去分も確認できます。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {periods.map((period) => {
                  const active = period.id === bundle.evaluationPeriodId;
                  return (
                    <Link
                      key={period.id}
                      href={`/evaluations/my?evaluationPeriodId=${period.id}`}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "border border-brand-300 bg-brand-200 text-black shadow-sm font-semibold" : "border border-slate-200 bg-white/90 text-black"}`}
                    >
                      <span style={{ color: "#000000" }}>{period.name}</span>
                    </Link>
                  );
                })}
              </div>
              <p className="mt-3 text-sm text-slate-300">対象期間: {bundle.periodName} / 状態: {periodStatusLabel}</p>
              {!canEdit ? <p className="mt-1 text-sm text-amber-200">この期間は閲覧専用です。過去分も確認できます。</p> : null}
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                ダッシュボードへ
              </Link>
              <Link href="/pl/monthly" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                月次PLへ
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <SelfReviewEditor canEdit={canEdit} defaults={bundle} />
        </div>
      </div>
    </main>
  );
}
