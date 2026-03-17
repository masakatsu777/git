import Link from "next/link";

import { UserManagementEditor } from "@/components/settings/user-management-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getUserManagementBundle } from "@/lib/users/user-management-service";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; teamId?: string; unassigned?: string }>;
}) {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.masterWrite);
  const params = await searchParams;

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">ユーザー管理</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
          </section>
        </div>
      </main>
    );
  }

  const bundle = await getUserManagementBundle();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">User Management</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">ユーザー管理</h1>
              <p className="mt-2 text-sm text-slate-300">社員追加、部署・チーム変更、ロール変更、パスワード再設定を行います。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/settings/organization" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                組織設定
              </Link>
              <Link href="/settings/career-statuses" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                等級一覧
              </Link>
              <Link href="/settings/audit-logs" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                監査ログ
              </Link>
            </div>
          </div>
        </header>
        <div className="mt-8">
          <UserManagementEditor
            rows={bundle.rows}
            roleOptions={bundle.roleOptions}
            departmentOptions={bundle.departmentOptions}
            teamOptions={bundle.teamOptions}
            initialDepartmentId={params.departmentId ?? ""}
            initialTeamId={params.teamId ?? ""}
            initialUnassignedOnly={params.unassigned === "1"}
            canEdit={canView}
          />
        </div>
      </div>
    </main>
  );
}
