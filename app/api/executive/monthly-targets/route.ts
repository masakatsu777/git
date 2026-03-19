import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { saveMonthlyTargetRates } from "@/lib/pl/service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.plAllRead);

    const body = (await request.json()) as Record<string, unknown>;
    const yearMonth = String(body.yearMonth ?? "");
    const targets = Array.isArray(body.targets)
      ? body.targets.map((row) => {
          const item = row as Record<string, unknown>;
          return {
            teamId: String(item.teamId ?? ""),
            targetGrossProfitRate: toNumber(item.targetGrossProfitRate),
          };
        }).filter((row) => row.teamId)
      : [];

    const result = await saveMonthlyTargetRates({
      yearMonth,
      targets,
    });

    return NextResponse.json({
      message: result.persisted ? "目標粗利率を更新しました" : "DB未接続のためプレビューのみ更新しました",
      persisted: result.persisted,
      data: result.snapshots,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update target rates" },
      { status: 403 },
    );
  }
}
