import { NextRequest, NextResponse } from "next/server";

import { saveAnnualGoal, getAnnualGoalListBundle } from "@/lib/annual-goals/service";
import { getSessionUser } from "@/lib/auth/demo-session";
import { writeAuditLog } from "@/lib/audit/log-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const bundle = await getAnnualGoalListBundle(user, {
      fiscalYear: request.nextUrl.searchParams.get("fiscalYear") ?? "",
      goalType: request.nextUrl.searchParams.get("goalType") ?? "",
      targetKeyword: request.nextUrl.searchParams.get("targetKeyword") ?? "",
      priorityKeyword: request.nextUrl.searchParams.get("priorityKeyword") ?? "",
      grossProfitStatus: request.nextUrl.searchParams.get("grossProfitStatus") ?? "",
    });

    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load annual goals" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const body = (await request.json()) as {
      id?: string;
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
      id: body.id,
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
      action: "SAVE_ANNUAL_GOAL",
      resourceType: "annual_goal",
      resourceId: result.id,
      afterJson: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save annual goal" },
      { status: 400 },
    );
  }
}
