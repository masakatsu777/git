import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { canAccessTeam, requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { deleteTeamMonthlySnapshot, getTeamMonthlySnapshot, getVisibleTeamMonthlySnapshots, saveTeamMonthlyInput } from "@/lib/pl/service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "2026-03";
  const teamId = request.nextUrl.searchParams.get("teamId");

  try {
    if (teamId) {
      requirePermission(user, PERMISSIONS.plTeamRead, teamId);
      const snapshot = await getTeamMonthlySnapshot(teamId, yearMonth);
      return NextResponse.json({ data: snapshot, scope: "team" });
    }

    if (user.role === "admin" || user.role === "president") {
      requirePermission(user, PERMISSIONS.plAllRead);
      const snapshots = await getVisibleTeamMonthlySnapshots(yearMonth);
      return NextResponse.json({ data: snapshots, scope: "all" });
    }

    const visibleTeamId = user.teamIds[0];
    if (!visibleTeamId || !canAccessTeam(user, visibleTeamId)) {
      return NextResponse.json({ message: "閲覧可能なチームがありません" }, { status: 403 });
    }

    requirePermission(user, PERMISSIONS.plTeamRead, visibleTeamId);
    const snapshot = await getTeamMonthlySnapshot(visibleTeamId, yearMonth);
    return NextResponse.json({ data: snapshot, scope: "team" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load monthly PL" },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const teamId = String(body.teamId ?? "");
    const yearMonth = String(body.yearMonth ?? "");

    requirePermission(user, PERMISSIONS.plTeamWrite, teamId);

    const result = await saveTeamMonthlyInput({
      teamId,
      yearMonth,
      salesTotal: toNumber(body.salesTotal),
      directLaborCost: toNumber(body.directLaborCost),
      outsourcingCost: toNumber(body.outsourcingCost),
      indirectCost: toNumber(body.indirectCost),
      fixedCostAllocation: toNumber(body.fixedCostAllocation),
    });

    return NextResponse.json({
      message: result.persisted ? "月次PLを保存しました" : "DB未接続のためプレビューのみ更新しました",
      persisted: result.persisted,
      data: result.snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save monthly PL" },
      { status: 403 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const teamId = request.nextUrl.searchParams.get("teamId") ?? "";
    const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "";

    requirePermission(user, PERMISSIONS.plTeamWrite, teamId);

    const result = await deleteTeamMonthlySnapshot(teamId, yearMonth);
    return NextResponse.json({
      message: result.persisted ? "月次PL手入力を削除しました" : "DB未接続のため削除は反映されませんでした",
      persisted: result.persisted,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete monthly PL" },
      { status: 403 },
    );
  }
}
