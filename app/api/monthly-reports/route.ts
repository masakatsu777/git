import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { writeAuditLog } from "@/lib/audit/log-service";
import { saveMonthlyReport } from "@/lib/monthly-reports/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const body = (await request.json()) as {
      yearMonth?: string;
      projectId?: string;
      projectName?: string;
      teamReport?: {
        projectSummary?: string;
        teamSelfGrowthIssue?: string;
        teamSelfGrowthResult?: string;
        teamSynergyIssue?: string;
        teamSynergyResult?: string;
      };
      personalReport?: {
        projectRole?: string;
        personalSelfGrowthIssue?: string;
        personalSelfGrowthResult?: string;
        personalSynergyIssue?: string;
        personalSynergyResult?: string;
      };
    };

    const result = await saveMonthlyReport(user, {
      yearMonth: String(body.yearMonth ?? ""),
      projectId: String(body.projectId ?? ""),
      projectName: String(body.projectName ?? ""),
      teamReport: body.teamReport ? {
        projectSummary: String(body.teamReport.projectSummary ?? ""),
        teamSelfGrowthIssue: String(body.teamReport.teamSelfGrowthIssue ?? ""),
        teamSelfGrowthResult: String(body.teamReport.teamSelfGrowthResult ?? ""),
        teamSynergyIssue: String(body.teamReport.teamSynergyIssue ?? ""),
        teamSynergyResult: String(body.teamReport.teamSynergyResult ?? ""),
      } : undefined,
      personalReport: {
        projectRole: String(body.personalReport?.projectRole ?? ""),
        personalSelfGrowthIssue: String(body.personalReport?.personalSelfGrowthIssue ?? ""),
        personalSelfGrowthResult: String(body.personalReport?.personalSelfGrowthResult ?? ""),
        personalSynergyIssue: String(body.personalReport?.personalSynergyIssue ?? ""),
        personalSynergyResult: String(body.personalReport?.personalSynergyResult ?? ""),
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "SAVE_MONTHLY_REPORT",
      resourceType: "monthly_report",
      resourceId: `${user.id}:${result.projectId}:${String(body.yearMonth ?? "")}`,
      afterJson: result,
    });

    return NextResponse.json({
      message: "月報を保存しました。",
      projectId: result.projectId,
      saved: {
        teamReportUpdated: result.teamReportUpdated,
        personalReportUpdated: result.personalReportUpdated,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save monthly report" },
      { status: 400 },
    );
  }
}
