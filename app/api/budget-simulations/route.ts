import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getBudgetSimulationBundle, saveBudgetSimulationBundle } from "@/lib/budget-simulations/budget-simulation-service";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.salaryRead);
    const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? undefined;
    const bundle = await getBudgetSimulationBundle(yearMonth ? { yearMonth } : undefined);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load budget simulations" },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.salaryWrite);
    const body = (await request.json()) as {
      yearMonth?: string;
      budgetTotal?: number;
      note?: string;
      evaluationPeriodId?: string;
      rows?: Array<Record<string, unknown>>;
    };

    const bundle = await saveBudgetSimulationBundle({
      yearMonth: String(body.yearMonth ?? ""),
      budgetTotal: toNumber(body.budgetTotal),
      note: String(body.note ?? ""),
      evaluationPeriodId: body.evaluationPeriodId ? String(body.evaluationPeriodId) : undefined,
      rows: (body.rows ?? []).map((row) => ({
        key: String(row.key ?? ""),
        assumedUnitPrice: toNumber(row.assumedUnitPrice),
        assumedDirectLaborCost: toNumber(row.assumedDirectLaborCost),
        assumedOutsourcingCost: toNumber(row.assumedOutsourcingCost),
        memo: String(row.memo ?? ""),
      })),
    });

    return NextResponse.json({
      message: bundle.source === "database" ? "予算制約シミュレーションを保存しました" : "DB未接続のためプレビュー設定を保存しました",
      data: bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save budget simulations" },
      { status: 403 },
    );
  }
}
