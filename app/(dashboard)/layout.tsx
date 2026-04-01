import { ReactNode } from "react";

import { SessionActionButton } from "@/components/auth/session-action-button";
import { DashboardGlobalNav } from "@/components/layout/dashboard-global-nav";
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
      <DashboardGlobalNav userName={user.name} role={user.role} items={items} />
      <div className="fixed right-6 top-4 z-50 hidden md:block">
        <SessionActionButton
          mode="logout"
          redirectTo="/login"
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
        >
          ログアウト
        </SessionActionButton>
      </div>
      {children}
    </>
  );
}
