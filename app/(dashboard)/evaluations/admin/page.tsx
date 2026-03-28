import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminInputEditor } from "@/components/evaluations/admin-input-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getAdminInputBundle } from "@/lib/evaluations/admin-input-service";
import { getEvaluationPeriodOptions, getEvaluationPeriodStatusLabel } from "@/lib/evaluations/period-service";
import { isUserMenuEnabled } from "@/lib/menu-visibility/menu-visibility-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getVisibleTeamOptions } from "@/lib/pl/service";

export default async function AdminEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ evaluationPeriodId?: string; teamId?: string; memberId?: string }>;
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

  if (!hasPermission(user, PERMISSIONS.masterWrite)) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-rose-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">評価初期設定を表示できません</h1>
          <p className="mt-3 text-sm text-slate-600">管理者のみ入力可の項目は、マスタ更新権限を持つユーザーのみ編集できます。</p>
        </div>
      </main>
    );
  }

  const periods = await getEvaluationPeriodOptions();
  const defaultEvaluationPeriodId = periods.find((period) => period.status === "OPEN")?.id ?? periods[0]?.id;
  const teamOptions = await getVisibleTeamOptions();
  const defaultTeamId = params.teamId ?? teamOptions[0]?.teamId;

  if (!params.evaluationPeriodId && defaultEvaluationPeriodId && defaultTeamId) {
    redirect(`/evaluations/admin?evaluationPeriodId=${defaultEvaluationPeriodId}&teamId=${defaultTeamId}`);
  }

  if (!defaultTeamId) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">対象チームがありません</h1>
          <p className="mt-3 text-sm text-slate-600">評価初期設定の対象となるチームが見つかりませんでした。</p>
        </div>
      </main>
    );
  }

  const bundle = await getAdminInputBundle(defaultTeamId, params.memberId, params.evaluationPeriodId ?? defaultEvaluationPeriodId);
  const periodStatusLabel = getEvaluationPeriodStatusLabel(bundle.periodStatus);
  const canEdit = bundle.periodStatus === "OPEN";

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Admin Input</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">評価初期設定</h1>
              <p className="mt-2 text-sm text-slate-300">管理者のみ入力可の項目を、対象社員ごとに設定します。</p>
              <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
                {params.memberId ? <input type="hidden" name="memberId" value={params.memberId} /> : null}
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
                  表示更新
                </button>
              </form>
              <p className="mt-3 text-sm text-slate-300">対象期間: {bundle.periodName} / 状態: {periodStatusLabel}</p>
              {!canEdit ? <p className="mt-1 text-sm text-amber-200">この期間の評価初期設定は閲覧専用です。</p> : null}
            </div>
            <div className="flex gap-3">
              <Link href={`/evaluations/team?evaluationPeriodId=${bundle.evaluationPeriodId}&teamId=${bundle.teamId}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                上長評価へ
              </Link>
              <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                ダッシュボードへ
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <AdminInputEditor canEdit={canEdit} defaults={bundle} />
        </div>
      </div>
    </main>
  );
}