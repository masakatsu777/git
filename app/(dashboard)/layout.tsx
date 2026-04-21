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
      <div className="relative z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur 2xl:sticky 2xl:top-0">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Navigation</p>
              <p className="mt-1 text-xs text-slate-600 sm:text-sm">{user.name} / {user.role}</p>
            </div>

            <form action="/auth/logout-web" method="post" className="hidden 2xl:block">
              <input type="hidden" name="redirectTo" value="/login" />
              <button
                type="submit"
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium !text-black transition hover:border-slate-300 hover:!text-black"
              >
                ログアウト
              </button>
            </form>
          </div>

          <div className="mt-3 hidden 2xl:flex 2xl:flex-wrap 2xl:gap-2">
            {items.map((item) => (
              <Link
                key={`${item.href}:${item.label}`}
                href={item.href}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium !text-black transition hover:border-slate-300 hover:!text-black"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <details className="mt-3 2xl:hidden">
            <summary className="list-none">
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium !text-black shadow-sm transition hover:border-slate-300 hover:!text-black">
                メニューを開く
              </span>
            </summary>
            <div className="mt-3 rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="grid gap-2">
                {items.map((item) => (
                  <Link
                    key={`${item.href}:${item.label}:mobile`}
                    href={item.href}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium !text-black transition hover:border-slate-300 hover:!text-black"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <form action="/auth/logout-web" method="post" className="mt-4 border-t border-slate-200 pt-4">
                <input type="hidden" name="redirectTo" value="/login" />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium !text-black transition hover:border-slate-300 hover:!text-black"
                >
                  ログアウト
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
      {children}
    </>
  );
}
