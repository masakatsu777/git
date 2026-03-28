import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getAdminInputBundle, saveAdminInputBundle } from "@/lib/evaluations/admin-input-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

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
  if (!hasPermission(user, PERMISSIONS.masterWrite)) {
    return NextResponse.json({ message: "評価初期設定の閲覧権限がありません" }, { status: 403 });
  }

  try {
    const teamId = request.nextUrl.searchParams.get("teamId") ?? "";
    const memberId = request.nextUrl.searchParams.get("memberId") ?? undefined;
    const evaluationPeriodId = request.nextUrl.searchParams.get("evaluationPeriodId") ?? undefined;
    const bundle = await getAdminInputBundle(teamId, memberId, evaluationPeriodId);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to load admin input bundle" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!hasPermission(user, PERMISSIONS.masterWrite)) {
    return NextResponse.json({ message: "評価初期設定の入力権限がありません" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      evaluationPeriodId?: string;
      teamId?: string;
      userId?: string;
      selfComment?: string;
      items?: Array<Record<string, unknown>>;
    };

    const bundle = await saveAdminInputBundle({
      evaluationPeriodId: String(body.evaluationPeriodId ?? ""),
      teamId: String(body.teamId ?? ""),
      userId: String(body.userId ?? ""),
      selfComment: String(body.selfComment ?? ""),
      items: (body.items ?? []).map((item) => ({
        evaluationItemId: String(item.evaluationItemId ?? ""),
        score: toNumber(item.score),
        comment: String(item.comment ?? ""),
        evidences: normalizeEvidences(item.evidences),
      })),
    });

    return NextResponse.json({
      message: bundle.source === "database" ? "評価初期設定を保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: bundle,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to save admin input bundle" }, { status: 403 });
  }
}