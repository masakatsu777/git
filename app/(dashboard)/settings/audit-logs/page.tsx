import Link from "next/link";

import { AuditLogExportButton } from "@/components/settings/audit-log-export-button";
import { getSessionUser } from "@/lib/auth/demo-session";
import { getAuditLogBundle } from "@/lib/audit/audit-log-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; actor?: string; action?: string }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const canView = hasPermission(user, PERMISSIONS.masterWrite) || hasPermission(user, PERMISSIONS.salaryApprove);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">監査ログ</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
          </section>
        </div>
      </main>
    );
  }

  const bundle = await getAuditLogBundle(params);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Audit Logs</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">監査ログ</h1>
              <p className="mt-2 text-sm text-slate-300">最終評価確定、昇給承認、パスワード変更などの操作履歴を確認します。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/settings/users" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                ユーザー管理
              </Link>
              <Link href="/salary/simulations" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                昇給シミュレーション
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <form method="get" className="grid gap-4 rounded-[1.5rem] bg-slate-50 p-4 md:grid-cols-4 md:items-end">
            <label className="text-sm text-slate-700">
              種別
              <select name="kind" defaultValue={params.kind ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
                <option value="">すべて</option>
                <option value="approval">approval</option>
                <option value="audit">audit</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              操作者
              <input type="text" name="actor" defaultValue={params.actor ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
            </label>
            <label className="text-sm text-slate-700">
              アクション
              <input type="text" name="action" defaultValue={params.action ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
            </label>
            <div className="flex gap-3">
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                絞り込む
              </button>
              <Link href="/settings/audit-logs" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                リセット
              </Link>
            </div>
          </form>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">表示件数: {bundle.rows.length}件</p>
            <AuditLogExportButton rows={bundle.rows} filters={params} />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">日時</th>
                  <th className="px-4 py-3 font-medium">種別</th>
                  <th className="px-4 py-3 font-medium">操作者</th>
                  <th className="px-4 py-3 font-medium">アクション</th>
                  <th className="px-4 py-3 font-medium">対象種別</th>
                  <th className="px-4 py-3 font-medium">対象ID</th>
                  <th className="px-4 py-3 font-medium">コメント</th>
                </tr>
              </thead>
              <tbody>
                {bundle.rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{row.actedAt}</td>
                    <td className="px-4 py-3 text-slate-700">{row.kind}</td>
                    <td className="px-4 py-3 text-slate-700">{row.actorName}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{row.action}</td>
                    <td className="px-4 py-3 text-slate-700">{row.targetType}</td>
                    <td className="px-4 py-3 text-slate-700">{row.targetId}</td>
                    <td className="px-4 py-3 text-slate-700">{row.comment || "-"}</td>
                  </tr>
                ))}
                {bundle.rows.length === 0 ? (
                  <tr className="border-t border-slate-200">
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">条件に一致するログがありません。</td>
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
