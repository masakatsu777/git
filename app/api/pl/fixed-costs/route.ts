import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getCompanyFixedCosts, getCompanyFixedCostSettingsBundle, saveCompanyFixedCosts } from "@/lib/pl/fixed-cost-service";
import { getVisibleYearMonthOptions, recalculateAllTeamMonthlyPl } from "@/lib/pl/service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "2026-03";

  try {
    requirePermission(user, PERMISSIONS.plAllRead);
    const data = request.nextUrl.searchParams.get("yearMonth") ? await getCompanyFixedCosts(yearMonth) : await getCompanyFixedCostSettingsBundle();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to load fixed costs" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as Record<string, unknown>;
    const rows = Array.isArray(body.rows)
      ? body.rows.map((row, index) => {
          const item = row as Record<string, unknown>;
          return {
            effectiveYearMonth: String(item.effectiveYearMonth ?? ""),
            effectiveEndYearMonth: item.effectiveEndYearMonth ? String(item.effectiveEndYearMonth) : null,
            category: String(item.category ?? `固定費-${index + 1}`),
            amount: toNumber(item.amount),
            departmentAllocations: Array.isArray(item.departmentAllocations)
              ? item.departmentAllocations.map((allocation) => {
                  const allocationItem = allocation as Record<string, unknown>;
                  return {
                    departmentId: String(allocationItem.departmentId ?? ""),
                    amount: toNumber(allocationItem.amount),
                  };
                }).filter((allocation) => allocation.departmentId)
              : [],
          };
        }).filter((row) => row.effectiveYearMonth)
      : [];

    const saved = await saveCompanyFixedCosts({ rows });
    const yearMonthOptions = await getVisibleYearMonthOptions();
    const snapshots = await Promise.all(yearMonthOptions.map((option) => recalculateAllTeamMonthlyPl(option.yearMonth)));

    return NextResponse.json({
      message: "全社固定費設定を保存し、表示対象月の月次PLを再計算しました",
      data: saved,
      snapshots,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to save fixed costs" }, { status: 403 });
  }
}
