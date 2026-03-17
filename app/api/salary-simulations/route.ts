import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSalarySimulationBundle, saveSalarySimulationBundle } from "@/lib/salary-simulations/salary-simulation-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.salaryRead);
    const evaluationPeriodId = request.nextUrl.searchParams.get("evaluationPeriodId") ?? undefined;
    const bundle = await getSalarySimulationBundle(evaluationPeriodId);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load salary simulations" },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.salaryWrite);
    const body = (await request.json()) as {
      evaluationPeriodId?: string;
      rows?: Array<Record<string, unknown>>;
    };

    const bundle = await saveSalarySimulationBundle({
      evaluationPeriodId: String(body.evaluationPeriodId ?? "period-2025-h2"),
      rows: (body.rows ?? []).map((row) => ({
        userId: String(row.userId ?? ""),
        newSalary: toNumber(row.newSalary),
        adjustmentReason: String(row.adjustmentReason ?? ""),
      })),
      actedBy: user.id,
    });

    return NextResponse.json({
      message: bundle.source === "database" ? "昇給シミュレーションを保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save salary simulations" },
      { status: 403 },
    );
  }
}
