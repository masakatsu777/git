import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getCompanyFixedCosts, saveCompanyFixedCosts } from "@/lib/pl/fixed-cost-service";
import { recalculateAllTeamMonthlyPl } from "@/lib/pl/service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "2026-03";

  try {
    requirePermission(user, PERMISSIONS.plAllRead);
    const rows = await getCompanyFixedCosts(yearMonth);
    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to load fixed costs" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as Record<string, unknown>;
    const yearMonth = String(body.yearMonth ?? "");
    const rows = Array.isArray(body.rows)
      ? body.rows.map((row, index) => {
          const item = row as Record<string, unknown>;
          return {
            category: String(item.category ?? `固定費-${index + 1}`),
            amount: toNumber(item.amount),
          };
        })
      : [];

    const saved = await saveCompanyFixedCosts({ yearMonth, rows });
    const snapshots = await recalculateAllTeamMonthlyPl(yearMonth);

    return NextResponse.json({
      message: "全社固定費を保存し、全チームの月次PLを再計算しました",
      data: saved,
      snapshots,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to save fixed costs" }, { status: 403 });
  }
}