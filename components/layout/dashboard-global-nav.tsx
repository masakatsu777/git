"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

type DashboardGlobalNavProps = {
  userName: string;
  role: string;
  items: NavItem[];
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardGlobalNav({ userName, role, items }: DashboardGlobalNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

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
        <nav
          id="dashboard-global-nav"
          className={`${isOpen ? "flex" : "hidden"} flex-col gap-2 lg:flex lg:flex-row lg:flex-wrap`}
        >
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white hover:border-slate-300"}`}
                onClick={() => setIsOpen(false)}
              >
                <span style={{ color: active ? "#ffffff" : "#000000" }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
