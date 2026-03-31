import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { applySalarySimulationBundle } from "@/lib/salary-simulations/salary-simulation-service";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.salaryWrite);
    const body = (await request.json()) as { evaluationPeriodId?: string };
    const bundle = await applySalarySimulationBundle(user.id, String(body.evaluationPeriodId ?? "period-2025-h2"));
    return NextResponse.json({
      message: bundle.source === "database" ? "昇給決定を社員コストへ反映しました" : "DB未接続のためプレビューのみ更新しました",
      data: bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to apply salary simulations" },
      { status: 403 },
    );
  }
}

