import Link from "next/link";
import { ReactNode } from "react";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getUserMenuVisibility } from "@/lib/menu-visibility/menu-visibility-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getSessionUser();
  const visibility = await getUserMenuVisibility(user.id, user.role);
  const hasPrimaryTeam = user.teamIds.length > 0;
  const items = [
    { href: "/menu", label: "メニュー" },
  ];

  if (visibility.philosophyPractice) {
    items.push(
      { href: "/dashboard", label: "月次" },
      { href: "/pl/annual-personal", label: "個人年度" },
      { href: "/evaluations/my", label: "自己評価" },
      { href: "/evaluations/result", label: "マイ評価結果" },
      { href: "/evaluations/team", label: "上長評価" },
      { href: "/evaluations/finalize", label: "最終評価" },
    );

    if (hasPermission(user, PERMISSIONS.salaryRead)) {
      items.push({ href: "/salary/simulations", label: "昇給決定" });
    }

    if (hasPrimaryTeam || hasPermission(user, PERMISSIONS.plAllRead)) {
      items.splice(2, 0, { href: "/pl/annual", label: "年度" });
    }
  }

  if (hasPermission(user, PERMISSIONS.plAllRead)) {
    items.unshift({ href: "/executive", label: "経営" });
  }

  if (user.role === "admin" || user.role === "president") {
    items.push(
      { href: "/pl/breakdown", label: "粗利内訳" },
      { href: "/pl/unassigned-monthly", label: "未所属売上" },
      { href: "/settings/other-costs", label: "その他コスト" },
    );
  }

  if (user.role === "leader" || user.role === "president") {
    items.push({ href: "/settings/rates", label: "単価" });
  }

  if (hasPermission(user, PERMISSIONS.salaryRead)) {
    items.push({ href: "/settings/monthly-labor-adjustments", label: "変動人件費" });
  }

  if (hasPermission(user, PERMISSIONS.masterWrite)) {
    items.push(
      { href: "/settings/organization", label: "組織" },
      { href: "/settings/evaluation-periods", label: "評価期間" },
      { href: "/settings/skill-careers", label: "スキル" },
      { href: "/settings/grade-salary-settings", label: "等級給与設定" },
      { href: "/settings/rates", label: "単価" },
      { href: "/settings/salary-records", label: "社員コスト" },
      { href: "/settings/fixed-costs", label: "固定費" },
      { href: "/settings/users", label: "ユーザー" },
      { href: "/settings/audit-logs", label: "監査ログ" },
      { href: "/operations/preflight", label: "本番前チェック" },
    );
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-slate-300 bg-slate-950 text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Navigation</p>
              <p className="mt-1 text-sm font-medium text-white">{user.name} / {user.role}</p>
            </div>
            <form action="/auth/logout-web" method="post">
              <input type="hidden" name="redirectTo" value="/login" />
              <button
                type="submit"
                className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                ログアウト
              </button>
            </form>
          </div>
          <nav className="flex flex-wrap gap-2">
            {items.map((item) => (
              <Link
                key={`${item.href}:${item.label}`}
                href={item.href}
                className="rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-brand-300 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {children}
    </>
  );
}
