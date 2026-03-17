import Link from "next/link";
import { getEmployeesPageContent, getRoleSwitcherItems } from "@/lib/viewer-context";
import { getUiSettings } from "@/lib/ui-settings";

export async function SiteHeader() {
  const employeesPageContent = await getEmployeesPageContent();
  const roleSwitcherItems = await getRoleSwitcherItems();
  const ui = await getUiSettings();

  const navigationItems = [
    { label: "ホーム", href: "/" },
    { label: employeesPageContent.navLabel, href: "/employees" },
    { label: ui.growthRecordsLabel, href: "/growth-records" },
    { label: ui.oneOnOneLabel, href: "/one-on-one" },
    { label: "環境設定", href: "/settings" },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-brand-200">
              Career Growth Portal
            </p>
            <p className="mt-1 text-sm text-slate-300">キャリア形成を支えるポータルのスターター</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Preview Role</span>
            {roleSwitcherItems.map((item) => (
              <Link
                key={item.role}
                href={`/api/preview-role?role=${item.role}&redirectTo=/employees`}
                className={
                  item.active
                    ? "rounded-full border border-brand-300/40 bg-brand-400/10 px-3 py-2 text-xs font-medium text-brand-100"
                    : "rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-brand-300/40 hover:text-white"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <nav className="mt-4 hidden flex-wrap gap-2 md:flex md:justify-end">
          {navigationItems.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-brand-300/50 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
