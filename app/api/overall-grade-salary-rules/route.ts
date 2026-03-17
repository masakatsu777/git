import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getOverallGradeSalaryRuleBundle, saveOverallGradeSalaryRuleBundle } from "@/lib/salary-rules/overall-grade-salary-rule-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const bundle = await getOverallGradeSalaryRuleBundle();
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load overall grade salary rules" },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      evaluationPeriodId?: string;
      rules?: Array<Record<string, unknown>>;
    };

    const result = await saveOverallGradeSalaryRuleBundle({
      evaluationPeriodId: String(body.evaluationPeriodId ?? ""),
      rules: (body.rules ?? []).map((row) => ({
        id: String(row.id ?? ""),
        rating: String(row.rating ?? ""),
        minRaise: toNumber(row.minRaise),
        maxRaise: toNumber(row.maxRaise),
        defaultRaise: toNumber(row.defaultRaise),
      })),
    });

    return NextResponse.json({
      message: result.source === "database" ? "総合等級別昇給ルールを保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save overall grade salary rules" },
      { status: 403 },
    );
  }
}
