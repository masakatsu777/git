import { NextRequest, NextResponse } from "next/server";

import { getAnnualGoalDetailBundle, saveAnnualGoal } from "@/lib/annual-goals/service";
import { getSessionUser } from "@/lib/auth/demo-session";
import { writeAuditLog } from "@/lib/audit/log-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  const { id } = await context.params;

  try {
    const bundle = await getAnnualGoalDetailBundle(user, id);
    if (!bundle) {
      return NextResponse.json({ message: "年度目標が見つかりません。" }, { status: 404 });
    }
    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load annual goal" },
      { status: 400 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      fiscalYear?: number;
      evaluationPeriodId?: string;
      priorityTheme?: string;
      currentAnalysis?: string;
      annualGoal?: string;
      grossProfitActions?: string;
      developmentActions?: string;
      kpi?: string;
      midtermMemo?: string;
    };

    const result = await saveAnnualGoal(user, {
      id,
      fiscalYear: Number(body.fiscalYear ?? 0),
      evaluationPeriodId: String(body.evaluationPeriodId ?? ""),
      priorityTheme: String(body.priorityTheme ?? ""),
      currentAnalysis: String(body.currentAnalysis ?? ""),
      annualGoal: String(body.annualGoal ?? ""),
      grossProfitActions: String(body.grossProfitActions ?? ""),
      developmentActions: String(body.developmentActions ?? ""),
      kpi: String(body.kpi ?? ""),
      midtermMemo: String(body.midtermMemo ?? ""),
    });

    await writeAuditLog({
      userId: user.id,
      action: "UPDATE_ANNUAL_GOAL",
      resourceType: "annual_goal",
      resourceId: result.id,
      afterJson: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update annual goal" },
      { status: 400 },
    );
  }
}
