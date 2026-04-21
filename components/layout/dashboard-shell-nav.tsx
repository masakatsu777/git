"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

type DashboardShellNavProps = {
  userName: string;
  role: string;
  items: NavItem[];
};

export function DashboardShellNav({ userName, role, items }: DashboardShellNavProps) {
  const pathname = usePathname();

  if (pathname === "/menu") {
    return null;
  }

  return (
    <div className="relative z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur 2xl:sticky 2xl:top-0">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Navigation</p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">{userName} / {role}</p>
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
  );
}
