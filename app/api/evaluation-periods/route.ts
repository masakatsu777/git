import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getEvaluationPeriodAdminBundle, saveEvaluationPeriods } from "@/lib/evaluations/evaluation-period-admin-service";
import { EvaluationPeriodStatus, PeriodType } from "@/generated/prisma";

export async function GET() {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const bundle = await getEvaluationPeriodAdminBundle();
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to load evaluation periods" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      rows?: Array<{
        id?: string;
        name?: string;
        periodType?: PeriodType;
        startDate?: string;
        endDate?: string;
        status?: EvaluationPeriodStatus;
      }>;
    };

    const result = await saveEvaluationPeriods({
      rows: (body.rows ?? []).map((row) => ({
        id: row.id ? String(row.id) : undefined,
        name: String(row.name ?? ""),
        periodType: row.periodType ?? PeriodType.HALF_YEAR,
        startDate: String(row.startDate ?? ""),
        endDate: String(row.endDate ?? ""),
        status: row.status ?? EvaluationPeriodStatus.DRAFT,
      })),
    });

    return NextResponse.json({
      data: result,
      message: result.source === "database" ? "評価期間を保存しました" : "DB未接続のためプレビューのみ更新しました",
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to save evaluation periods" }, { status: 403 });
  }
}
