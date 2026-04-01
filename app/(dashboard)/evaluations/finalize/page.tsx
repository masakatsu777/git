import Link from "next/link";
import { redirect } from "next/navigation";

import { FinalReviewEditor } from "@/components/evaluations/final-review-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getFinalReviewBundle } from "@/lib/evaluations/final-review-service";
import { getEvaluationPeriodOptions, getEvaluationPeriodStatusLabel } from "@/lib/evaluations/period-service";
import { isUserMenuEnabled } from "@/lib/menu-visibility/menu-visibility-service";
import { canViewFinalReview, hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

export default async function FinalizeEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; evaluationPeriodId?: string }>;
}) {
  const user = await getSessionUser();
  const philosophyPracticeEnabled = await isUserMenuEnabled(user.id, "philosophyPractice", user.role);
  const params = await searchParams;

  if (!philosophyPracticeEnabled) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">理念実践ナビの対象外です</h1>
          <p className="mt-3 text-sm text-slate-600">この機能は現在のメニュー設定では利用対象外です。必要に応じて管理者へご相談ください。</p>
        </div>
      </main>
    );
  }
  const effectiveMemberId = user.role === "employee" ? user.id : params.memberId;
  const canView = canViewFinalReview(user, effectiveMemberId);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-rose-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">最終評価を表示できません</h1>
          <p className="mt-3 text-sm text-slate-600">社員は自分に関する最終評価のみ閲覧できます。</p>
        </div>
      </main>
    );
  }

  const periods = await getEvaluationPeriodOptions();
  const defaultEvaluationPeriodId = periods.find((period) => period.status === "OPEN")?.id ?? periods[0]?.id;
  const selectedEvaluationPeriodId = params.evaluationPeriodId ?? defaultEvaluationPeriodId;

  if (!params.evaluationPeriodId && selectedEvaluationPeriodId) {
    const memberQuery = effectiveMemberId ? `&memberId=${effectiveMemberId}` : "";
    redirect(`/evaluations/finalize?evaluationPeriodId=${selectedEvaluationPeriodId}${memberQuery}`);
  }

  const bundle = await getFinalReviewBundle(effectiveMemberId, selectedEvaluationPeriodId);
  const canEdit = hasPermission(user, PERMISSIONS.evaluationFinalize) && bundle.periodStatus === "CLOSED";
  const periodStatusLabel = getEvaluationPeriodStatusLabel(bundle.periodStatus);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Final Review</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">最終評価確定</h1>
              <p className="mt-2 text-sm text-slate-300">
                {user.role === "employee"
                  ? "自分に対する最終評価内容を確認できます。"
                  : canEdit
                    ? "管理者・役員が最終評価を確定する画面です。"
                    : "最終評価内容を参照できます。"}
              </p>
              <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
                {effectiveMemberId ? <input type="hidden" name="memberId" value={effectiveMemberId} /> : null}
                <label className="text-sm text-slate-200">
                  評価期間
                  <select
                    name="evaluationPeriodId"
                    defaultValue={bundle.evaluationPeriodId}
                    className="mt-2 min-w-64 rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                  >
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name}（{period.status}）
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                  表示更新
                </button>
              </form>
              <p className="mt-3 text-sm text-slate-300">対象期間: {bundle.periodName} / 状態: {periodStatusLabel}</p>
              {!canEdit ? <p className="mt-1 text-sm text-amber-200">この期間の最終評価は閲覧専用です。</p> : null}
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                ダッシュボードへ
              </Link>
              <Link href={`/evaluations/team?evaluationPeriodId=${bundle.evaluationPeriodId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                上長評価
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <FinalReviewEditor canEdit={canEdit} defaults={user.role === "employee" ? { ...bundle, members: bundle.members.filter((member) => member.userId === user.id) } : bundle} />
        </div>
      </div>
    </main>
  );
}
