import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { canViewFinalReview, requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getFinalReviewBundle, saveFinalReviewBundle } from "@/lib/evaluations/final-review-service";
import { resolveEvaluationPeriod } from "@/lib/evaluations/period-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeEvidences(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => ({
        id: typeof entry === "object" && entry && "id" in entry ? String(entry.id ?? "") || undefined : undefined,
        summary: typeof entry === "object" && entry && "summary" in entry ? String(entry.summary ?? "") : "",
        targetName: typeof entry === "object" && entry && "targetName" in entry ? String(entry.targetName ?? "") : "",
        periodNote: typeof entry === "object" && entry && "periodNote" in entry ? String(entry.periodNote ?? "") : "",
      }))
    : [];
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const requestedMemberId = request.nextUrl.searchParams.get("memberId") ?? undefined;
  const effectiveMemberId = user.role === "employee" ? user.id : requestedMemberId;

  try {
    if (!canViewFinalReview(user, effectiveMemberId)) {
      return NextResponse.json({ message: "最終評価の閲覧権限がありません" }, { status: 403 });
    }

    const evaluationPeriodId = request.nextUrl.searchParams.get("evaluationPeriodId") ?? undefined;
    const bundle = await getFinalReviewBundle(effectiveMemberId, evaluationPeriodId);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load final review" },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.evaluationFinalize);
    const body = (await request.json()) as {
      evaluationPeriodId?: string;
      userId?: string;
      finalComment?: string;
      items?: Array<Record<string, unknown>>;
    };

    const period = await resolveEvaluationPeriod(String(body.evaluationPeriodId ?? "period-2025-h2"));
    if (period.status !== "CLOSED") {
      return NextResponse.json({ message: "この評価期間は最終評価確定フェーズではありません" }, { status: 403 });
    }

    const bundle = await saveFinalReviewBundle(user.id, {
      evaluationPeriodId: String(body.evaluationPeriodId ?? "period-2025-h2"),
      userId: String(body.userId ?? ""),
      finalComment: String(body.finalComment ?? ""),
      items: (body.items ?? []).map((item) => ({
        evaluationItemId: String(item.evaluationItemId ?? ""),
        score: toNumber(item.score),
        comment: String(item.comment ?? ""),
        evidences: normalizeEvidences(item.evidences),
      })),
    });

    return NextResponse.json({
      message: bundle.source === "database" ? "最終評価を確定しました" : "DB未接続のためプレビューのみ更新しました",
      data: bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save final review" },
      { status: 403 },
    );
  }
}
