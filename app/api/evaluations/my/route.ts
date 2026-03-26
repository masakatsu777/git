import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSelfReviewBundle, saveSelfReviewBundle } from "@/lib/evaluations/self-review-service";
import { resolveEvaluationPeriod } from "@/lib/evaluations/period-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.evaluationSelfWrite);
    const evaluationPeriodId = request.nextUrl.searchParams.get("evaluationPeriodId") ?? undefined;
    const bundle = await getSelfReviewBundle(user.id, user.role, evaluationPeriodId);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load self review" },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.evaluationSelfWrite);
    const body = (await request.json()) as {
      evaluationPeriodId?: string;
      selfComment?: string;
      items?: Array<Record<string, unknown>>;
    };

    const period = await resolveEvaluationPeriod(String(body.evaluationPeriodId ?? "period-2025-h2"));
    if (period.status !== "OPEN") {
      return NextResponse.json({ message: "この評価期間は閲覧専用です" }, { status: 403 });
    }

    const bundle = await saveSelfReviewBundle(user.id, user.role, user.teamIds[0] ?? null, {
      evaluationPeriodId: String(body.evaluationPeriodId ?? "period-2025-h2"),
      selfComment: String(body.selfComment ?? ""),
      items: (body.items ?? []).map((item) => ({
        evaluationItemId: String(item.evaluationItemId ?? ""),
        score: toNumber(item.score),
        comment: String(item.comment ?? ""),
        evidences: Array.isArray(item.evidences)
          ? item.evidences.map((evidence) => ({
              id: typeof evidence === "object" && evidence !== null ? String((evidence as Record<string, unknown>).id ?? "") || undefined : undefined,
              summary: typeof evidence === "object" && evidence !== null ? String((evidence as Record<string, unknown>).summary ?? "") : "",
              targetName: typeof evidence === "object" && evidence !== null ? String((evidence as Record<string, unknown>).targetName ?? "") : "",
              periodNote: typeof evidence === "object" && evidence !== null ? String((evidence as Record<string, unknown>).periodNote ?? "") : "",
            }))
          : [],
      })),
    });

    return NextResponse.json({
      message: bundle.source === "database" ? "自己評価を保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save self review" },
      { status: 403 },
    );
  }
}

