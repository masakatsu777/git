import Link from "next/link";
import { redirect } from "next/navigation";

import { ManagerReviewEditor } from "@/components/evaluations/manager-review-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getManagerReviewBundle } from "@/lib/evaluations/manager-review-service";
import { getFinalReviewBundle } from "@/lib/evaluations/final-review-service";
import { getEvaluationPeriodOptions, getEvaluationPeriodStatusLabel } from "@/lib/evaluations/period-service";
import { isUserMenuEnabled } from "@/lib/menu-visibility/menu-visibility-service";
import { canEditManagerReview, canViewManagerReview } from "@/lib/permissions/check";
import { getDepartmentScopedTeamIds, getVisibleTeamOptions } from "@/lib/pl/service";

export default async function TeamEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; evaluationPeriodId?: string; teamId?: string }>;
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
  const defaultEvaluationPeriodId = periods.find((period) => period.status === "OPEN")?.id ?? periods[0]?.id;

  const visibleTeamIds = user.role === "leader" ? await getDepartmentScopedTeamIds(user.teamIds) : user.teamIds;
  const teamOptions = user.role === "employee"
    ? []
    : await getVisibleTeamOptions(user.role === "admin" || user.role === "president" ? undefined : user.role === "leader" ? visibleTeamIds : user.teamIds);
  const defaultTeamId = params.teamId ?? teamOptions[0]?.teamId ?? visibleTeamIds[0] ?? user.teamIds[0] ?? "team-platform";
  const requestedTeamId = defaultTeamId;
  const effectiveMemberId = user.role === "employee" ? user.id : params.memberId;

  if (!params.evaluationPeriodId && defaultEvaluationPeriodId) {
    const memberQuery = effectiveMemberId ? `&memberId=${effectiveMemberId}` : "";
    redirect(`/evaluations/team?evaluationPeriodId=${defaultEvaluationPeriodId}&teamId=${requestedTeamId}${memberQuery}`);
  }

  const canView = canViewManagerReview(user, requestedTeamId, effectiveMemberId)
    && (user.role !== "leader" || visibleTeamIds.includes(requestedTeamId));

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-rose-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">上長評価を表示できません</h1>
          <p className="mt-3 text-sm text-slate-600">社員は自分に関する上長評価のみ閲覧できます。</p>
        </div>
      </main>
    );
  }

  const [bundle, resultSummary] = await Promise.all([
    getManagerReviewBundle(requestedTeamId, effectiveMemberId, params.evaluationPeriodId),
    getFinalReviewBundle(effectiveMemberId, params.evaluationPeriodId),
  ]);
  const canEdit = canEditManagerReview(user, bundle.teamId) && bundle.periodStatus === "OPEN";
  const periodStatusLabel = getEvaluationPeriodStatusLabel(bundle.periodStatus);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Manager Review</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">上長評価</h1>
              <p className="mt-2 text-sm text-slate-300">
                {user.role === "employee"
                  ? "自分に対する上長評価内容を確認できます。"
                  : canEdit
                    ? `${bundle.teamName} のメンバー評価を入力します。`
                    : `${bundle.teamName} のメンバー評価を参照できます。`}
              </p>
              <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="teamId" value={bundle.teamId} />
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
              {!canEdit ? <p className="mt-1 text-sm text-amber-200">この期間の上長評価は閲覧専用です。</p> : null}
              {teamOptions.length > 0 ? (
                <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="evaluationPeriodId" value={bundle.evaluationPeriodId} />
                  {effectiveMemberId ? <input type="hidden" name="memberId" value={effectiveMemberId} /> : null}
                  <label className="text-sm text-slate-200">
                    評価対象チーム
                    <select
                      name="teamId"
                      defaultValue={bundle.teamId}
                      className="mt-2 min-w-56 rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
                    >
                      {teamOptions.map((team) => (
                        <option key={team.teamId} value={team.teamId}>
                          {team.teamName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                    チーム切替
                  </button>
                </form>
              ) : null}
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                ダッシュボードへ
              </Link>
              <Link href={`/evaluations/my?evaluationPeriodId=${bundle.evaluationPeriodId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                半期自己評価
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <ManagerReviewEditor key={`${bundle.evaluationPeriodId}:${bundle.teamId}:${bundle.selectedUserId}`} canEdit={canEdit} defaults={user.role === "employee" ? { ...bundle, members: bundle.members.filter((member) => member.userId === user.id) } : bundle} summary={resultSummary} />
        </div>
      </div>
    </main>
  );
}
