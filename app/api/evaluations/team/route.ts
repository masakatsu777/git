import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { canEditManagerReview, canViewManagerReview } from "@/lib/permissions/check";
import { getManagerReviewBundle, saveManagerReviewBundle } from "@/lib/evaluations/manager-review-service";
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
  const requestedTeamId = request.nextUrl.searchParams.get("teamId") ?? user.teamIds[0] ?? "team-platform";
  const requestedMemberId = request.nextUrl.searchParams.get("memberId") ?? undefined;
  const effectiveMemberId = user.role === "employee" ? user.id : requestedMemberId;

  try {
    if (!canViewManagerReview(user, requestedTeamId, effectiveMemberId)) {
      return NextResponse.json({ message: "上長評価の閲覧権限がありません" }, { status: 403 });
    }

    const evaluationPeriodId = request.nextUrl.searchParams.get("evaluationPeriodId") ?? undefined;
    const bundle = await getManagerReviewBundle(requestedTeamId, effectiveMemberId, evaluationPeriodId);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load manager review" },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const body = (await request.json()) as {
      evaluationPeriodId?: string;
      userId?: string;
      teamId?: string;
      managerComment?: string;
      items?: Array<Record<string, unknown>>;
    };

    const teamId = String(body.teamId ?? user.teamIds[0] ?? "team-platform");
    if (!canEditManagerReview(user, teamId)) {
      return NextResponse.json({ message: "上長評価の入力権限がありません" }, { status: 403 });
    }

    const period = await resolveEvaluationPeriod(String(body.evaluationPeriodId ?? "period-2025-h2"));
    if (period.status !== "OPEN") {
      return NextResponse.json({ message: "この評価期間は閲覧専用です" }, { status: 403 });
    }

    const bundle = await saveManagerReviewBundle(teamId, {
      evaluationPeriodId: String(body.evaluationPeriodId ?? "period-2025-h2"),
      userId: String(body.userId ?? ""),
      managerComment: String(body.managerComment ?? ""),
      items: (body.items ?? []).map((item) => ({
        evaluationItemId: String(item.evaluationItemId ?? ""),
        score: toNumber(item.score),
        comment: String(item.comment ?? ""),
        evidences: normalizeEvidences(item.evidences),
      })),
    });

    return NextResponse.json({
      message: bundle.source === "database" ? "上長評価を保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save manager review" },
      { status: 403 },
    );
  }
}
