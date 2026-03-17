import Link from "next/link";

import { FinalReviewEditor } from "@/components/evaluations/final-review-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { isUserMenuEnabled } from "@/lib/menu-visibility/menu-visibility-service";
import { getFinalReviewBundle } from "@/lib/evaluations/final-review-service";
import { getEvaluationPeriodOptions } from "@/lib/evaluations/period-service";
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
          <h1 className="text-2xl font-semibold text-slate-950">理念実践管理の対象外です</h1>
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

  const canEdit = hasPermission(user, PERMISSIONS.evaluationFinalize);
  const bundle = await getFinalReviewBundle(effectiveMemberId, params.evaluationPeriodId);
  const periods = await getEvaluationPeriodOptions();

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
                    ? "管理者・社長が最終評価を確定する画面です。"
                    : "最終評価内容を参照できます。"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {periods.map((period) => {
                  const active = period.id === bundle.evaluationPeriodId;
                  const memberQuery = effectiveMemberId ? `&memberId=${effectiveMemberId}` : "";
                  return (
                    <Link
                      key={period.id}
                      href={`/evaluations/finalize?evaluationPeriodId=${period.id}${memberQuery}`}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-white text-slate-950" : "border border-white/15 text-white"}`}
                    >
                      {period.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                ダッシュボードへ
              </Link>
              <Link href="/settings/career-statuses" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                等級一覧
              </Link>
              <Link href={`/evaluations/team?evaluationPeriodId=${bundle.evaluationPeriodId}`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
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
