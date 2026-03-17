import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { recalculateTeamMonthlyPl } from "@/lib/pl/service";

type Context = {
  params: Promise<{
    teamId: string;
  }>;
};

export async function POST(request: NextRequest, context: Context) {
  const user = await getSessionUser();
  const { teamId } = await context.params;
  const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "2026-03";

  try {
    requirePermission(user, PERMISSIONS.plTeamWrite, teamId);
    const snapshot = await recalculateTeamMonthlyPl(teamId, yearMonth);

    return NextResponse.json({
      message: "月次PLを再計算しました",
      data: snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to recalculate" },
      { status: 403 },
    );
  }
}