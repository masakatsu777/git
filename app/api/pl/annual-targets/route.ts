import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { saveAnnualTargetRate } from "@/lib/pl/annual-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.plAllRead);

    const body = (await request.json()) as Record<string, unknown>;
    const result = await saveAnnualTargetRate({
      fiscalYear: toNumber(body.fiscalYear),
      fiscalStartMonth: toNumber(body.fiscalStartMonth),
      targetGrossProfitRate: toNumber(body.targetGrossProfitRate),
    });

    return NextResponse.json({
      persisted: result.persisted,
      message: result.persisted ? "年度目標粗利率を保存しました" : "DB未接続のためプレビューのみ更新しました",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save annual target rate" },
      { status: 403 },
    );
  }
}
