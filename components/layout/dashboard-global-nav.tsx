"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Navigation</p>
          <p className="mt-1 text-sm text-slate-600">
            {userName} / {role}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
