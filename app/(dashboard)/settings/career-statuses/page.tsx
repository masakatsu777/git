import Link from "next/link";

import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getCareerStatusBundle } from "@/lib/skill-careers/career-status-service";

function normalizeText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

export default async function CareerStatusesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    team?: string;
    rating?: string;
    itChange?: string;
    bizChange?: string;
  }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const canView = hasPermission(user, PERMISSIONS.masterWrite) || hasPermission(user, PERMISSIONS.evaluationFinalize);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">等級一覧</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
          </section>
        </div>
      </main>
    );
  }

  const bundle = await getCareerStatusBundle();
  const q = normalizeText(params.q);
  const team = params.team ?? "";
  const rating = params.rating ?? "";
  const itChange = params.itChange ?? "";
  const bizChange = params.bizChange ?? "";

  const filteredRows = bundle.rows.filter((row) => {
    const matchesQuery =
      !q ||
      normalizeText(row.employeeName).includes(q) ||
      normalizeText(row.teamName).includes(q) ||
      normalizeText(row.latestItSkillGradeName).includes(q) ||
      normalizeText(row.latestBusinessSkillGradeName).includes(q) ||
      normalizeText(row.latestOverallGradeName).includes(q);
    const matchesTeam = !team || row.teamName === team;
    const matchesRating = !rating || row.latestFinalRating === rating;
    const matchesItChange = !itChange || row.itGradeChange === itChange;
    const matchesBizChange = !bizChange || row.businessGradeChange === bizChange;

    return matchesQuery && matchesTeam && matchesRating && matchesItChange && matchesBizChange;
  });

  const teamOptions = Array.from(new Set(bundle.rows.map((row) => row.teamName))).sort((a, b) => a.localeCompare(b, "ja"));
  const ratingOptions = Array.from(new Set(bundle.rows.map((row) => row.latestFinalRating))).sort((a, b) => a.localeCompare(b, "ja"));
  const changeOptions = Array.from(
    new Set(bundle.rows.flatMap((row) => [row.itGradeChange, row.businessGradeChange])),
  ).sort((a, b) => a.localeCompare(b, "ja"));

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Grade Status</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">等級一覧</h1>
              <p className="mt-2 text-sm text-slate-300">社員ごとの現在等級と、前回評価からの変化を確認します。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/settings/skill-careers" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                評価制度設定
              </Link>
              <Link href="/evaluations/finalize" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                最終評価へ
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <form method="get" className="grid gap-4 rounded-[1.5rem] bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm text-slate-700">
              名前・所属・等級検索
              <input
                type="text"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="開発 一郎 / プラットフォーム"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              所属チーム
              <select name="team" defaultValue={team} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="">すべて</option>
                {teamOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              期待充足ランク
              <select name="rating" defaultValue={rating} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="">すべて</option>
                {ratingOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              自律成長等級変化
              <select name="itChange" defaultValue={itChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="">すべて</option>
                {changeOptions.map((option) => (
                  <option key={`it-${option}`} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              協調相乗等級変化
              <select name="bizChange" defaultValue={bizChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="">すべて</option>
                {changeOptions.map((option) => (
                  <option key={`biz-${option}`} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-5">
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                絞り込む
              </button>
              <Link href="/settings/career-statuses" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                条件をリセット
              </Link>
              <span className="text-sm text-slate-500">表示件数: {filteredRows.length} / {bundle.rows.length}</span>
            </div>
          </form>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">社員</th>
                  <th className="px-4 py-3 font-medium">所属</th>
                  <th className="px-4 py-3 font-medium">最新評価期間</th>
                  <th className="px-4 py-3 font-medium">期待充足ランク</th>
                  <th className="px-4 py-3 font-medium">現在総合等級</th>
                  <th className="px-4 py-3 font-medium">現在自律成長等級</th>
                  <th className="px-4 py-3 font-medium">現在協調相乗等級</th>
                  <th className="px-4 py-3 font-medium">前回総合等級</th>
                  <th className="px-4 py-3 font-medium">前回自律成長等級</th>
                  <th className="px-4 py-3 font-medium">前回協調相乗等級</th>
                  <th className="px-4 py-3 font-medium">総合変化</th>
                  <th className="px-4 py-3 font-medium">自律変化</th>
                  <th className="px-4 py-3 font-medium">協調変化</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.userId} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-950"><Link href={`/settings/career-statuses/${row.userId}`} className="text-brand-700 underline-offset-4 hover:underline">{row.employeeName}</Link></td>
                    <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.latestPeriodName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.latestFinalRating}</td>
                    <td className="px-4 py-3 text-slate-700">{row.latestOverallGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.latestItSkillGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.latestBusinessSkillGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.previousOverallGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.previousItSkillGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.previousBusinessSkillGradeName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.overallGradeChange}</td>
                    <td className="px-4 py-3 text-slate-700">{row.itGradeChange}</td>
                    <td className="px-4 py-3 text-slate-700">{row.businessGradeChange}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr className="border-t border-slate-200">
                    <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                      条件に一致する社員が見つかりませんでした。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

