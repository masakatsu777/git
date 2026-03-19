import Link from "next/link";

import { CompanyFixedCostEditor } from "@/components/pl/company-fixed-cost-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getCompanyFixedCostSettings } from "@/lib/pl/fixed-cost-service";

export default async function FixedCostsPage() {
  const user = await getSessionUser();
  const rows = await getCompanyFixedCostSettings();
  const canEdit = hasPermission(user, PERMISSIONS.masterWrite);
  const canManageSalary = hasPermission(user, PERMISSIONS.salaryRead);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4f8ff_0%,#edf3ff_100%)] text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Company Overhead</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">全社固定費設定</h1>
              <p className="mt-2 text-sm text-slate-300">適用開始年月ごとに固定費を設定し、各月では有効な最新設定を人数比按分します。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/pl/monthly" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                月次PLへ戻る
              </Link>
              {canManageSalary ? (
                <>
                  <Link href="/settings/salary-records" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                    社員コスト設定
                  </Link>
                  <Link href="/settings/rates" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                    単価
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mt-8">
          <CompanyFixedCostEditor
            canEdit={canEdit}
            defaults={rows.map((row) => ({ id: row.id, effectiveYearMonth: row.effectiveYearMonth, category: row.category, amount: row.amount }))}
          />
        </div>
      </div>
    </main>
  );
}
