import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getTeamMonthlySnapshot, getVisibleTeamMonthlySnapshots } from "@/lib/pl/service";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const teamId = request.nextUrl.searchParams.get("teamId") ?? "team-platform";
  const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "2026-03";

  try {
    if (user.role === "admin" || user.role === "president") {
      requirePermission(user, PERMISSIONS.plAllRead);
      const snapshots = await getVisibleTeamMonthlySnapshots(yearMonth);
      return NextResponse.json({ data: snapshots, scope: "all" });
    }

    requirePermission(user, PERMISSIONS.plTeamRead, teamId);
    const snapshot = await getTeamMonthlySnapshot(teamId, yearMonth);

    return NextResponse.json({ data: [snapshot], scope: "team" });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Forbidden",
      },
      { status: 403 },
    );
  }
}