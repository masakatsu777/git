import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getTeamMonthlyDetails, saveTeamMonthlyDetails } from "@/lib/pl/detail-service";
import { recalculateTeamMonthlyPl } from "@/lib/pl/service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const teamId = request.nextUrl.searchParams.get("teamId") ?? user.teamIds[0] ?? "team-platform";
  const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "2026-03";

  try {
    requirePermission(user, PERMISSIONS.plTeamRead, teamId);
    const bundle = await getTeamMonthlyDetails(teamId, yearMonth);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to load details" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const teamId = String(body.teamId ?? "");
    const yearMonth = String(body.yearMonth ?? "");

    requirePermission(user, PERMISSIONS.plTeamWrite, teamId);

    const result = await saveTeamMonthlyDetails({
      teamId,
      yearMonth,
      assignments: Array.isArray(body.assignments) ? body.assignments.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          targetType: item.targetType === "PARTNER" ? "PARTNER" : "EMPLOYEE",
          userId: typeof item.userId === "string" ? item.userId : null,
          partnerId: typeof item.partnerId === "string" ? item.partnerId : null,
          unitPrice: toNumber(item.unitPrice),
          salesAmount: toNumber(item.salesAmount),
          workRate: toNumber(item.workRate),
          remarks: String(item.remarks ?? ""),
        };
      }) : [],
      outsourcingCosts: Array.isArray(body.outsourcingCosts) ? body.outsourcingCosts.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          partnerId: typeof item.partnerId === "string" ? item.partnerId : null,
          amount: toNumber(item.amount),
          remarks: String(item.remarks ?? ""),
        };
      }) : [],
      teamExpenses: Array.isArray(body.teamExpenses) ? body.teamExpenses.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          category: String(item.category ?? "その他経費"),
          amount: toNumber(item.amount),
          remarks: String(item.remarks ?? ""),
        };
      }) : [],
      salesTarget: toNumber(body.salesTarget),
      grossProfitTarget: toNumber(body.grossProfitTarget),
      grossProfitRateTarget: toNumber(body.grossProfitRateTarget),
    });

    const snapshot = await recalculateTeamMonthlyPl(teamId, yearMonth);

    return NextResponse.json({
      message: result.persisted ? "明細を保存し、月次PLを自動再計算しました" : "DB未接続のためプレビューのみ保持しました",
      persisted: result.persisted,
      data: result.bundle,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to save details" }, { status: 403 });
  }
}