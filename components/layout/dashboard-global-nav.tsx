"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { SessionActionButton } from "@/components/auth/session-action-button";

type NavItem = {
  href: string;
  label: string;
};

type DashboardGlobalNavProps = {
  userName: string;
  role: string;
  items: NavItem[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getGroupTitle(label: string) {
  if (["月次", "年度", "個人年度", "経営"].includes(label)) return "ダッシュボード";
  if (["自己評価", "マイ評価結果", "上長評価", "最終評価"].includes(label)) return "評価";
  if (["昇給決定", "粗利内訳", "未所属売上"].includes(label)) return "収益";
  if (["変動人件費", "単価", "社員コスト", "固定費", "その他コスト"].includes(label)) return "コスト・単価";
  if (["組織", "評価期間", "スキル", "等級給与設定", "ユーザー", "監査ログ", "本番前チェック"].includes(label)) return "設定";
  return "その他";
}

function buildGroups(items: NavItem[]): NavGroup[] {
  const order = ["ダッシュボード", "評価", "収益", "コスト・単価", "設定", "その他"];
  const grouped = new Map<string, NavItem[]>();

  for (const item of items) {
    const title = getGroupTitle(item.label);
    grouped.set(title, [...(grouped.get(title) ?? []), item]);
  }

  return order
    .map((title) => ({ title, items: grouped.get(title) ?? [] }))
    .filter((group) => group.items.length > 0);
}

export function DashboardGlobalNav({ userName, role, items }: DashboardGlobalNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const groups = useMemo(() => buildGroups(items), [items]);

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Navigation</p>
            <p className="mt-1 text-sm text-slate-600">
              {userName} / {role}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 lg:hidden"
            aria-expanded={isOpen}
            aria-controls="dashboard-global-nav"
          >
            {isOpen ? "メニューを閉じる" : "メニューを開く"}
          </button>
        </div>

        <div className="hidden lg:flex lg:items-center lg:gap-3">
          <nav className="flex flex-wrap gap-2">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <span style={{ color: active ? "#ffffff" : "#000000" }}>{item.label}</span>
              </Link>
            );
          })}
          </nav>
          <SessionActionButton
            mode="logout"
            redirectTo="/login"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            ログアウト
          </SessionActionButton>
        </div>

        {isOpen ? (
          <div id="dashboard-global-nav" className="lg:hidden">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="space-y-4">
                {groups.map((group) => (
                  <section key={group.title}>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{group.title}</p>
                    <div className="mt-2 grid gap-2">
                      {group.items.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300"}`}
                            onClick={() => setIsOpen(false)}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <SessionActionButton
                  mode="logout"
                  redirectTo="/login"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                >
                  ログアウト
                </SessionActionButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
