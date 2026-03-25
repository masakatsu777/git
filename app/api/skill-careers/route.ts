import { NextResponse } from "next/server";

import { SkillCategory } from "@/generated/prisma";
import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSkillCareerSettingsBundle, saveSkillCareerSettingsBundle, type EvaluationInputScope } from "@/lib/skill-careers/skill-career-setting-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCategory(value: unknown): SkillCategory {
  return value === SkillCategory.BUSINESS_SKILL ? SkillCategory.BUSINESS_SKILL : SkillCategory.IT_SKILL;
}

function toAxis(value: unknown): "SELF_GROWTH" | "SYNERGY" {
  return value === "SYNERGY" ? "SYNERGY" : "SELF_GROWTH";
}

function toScoreType(value: unknown): "LEVEL_2" | "CONTINUOUS_DONE" {
  return value === "CONTINUOUS_DONE" ? "CONTINUOUS_DONE" : "LEVEL_2";
}

function toInputScope(value: unknown): EvaluationInputScope {
  return value === "SELF" || value === "MANAGER" || value === "BOTH" ? value : "BOTH";
}

export async function GET() {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const bundle = await getSkillCareerSettingsBundle();
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load skill career settings" },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      grades?: Array<Record<string, unknown>>;
      evaluationItems?: Array<Record<string, unknown>>;
    };

    const result = await saveSkillCareerSettingsBundle({
      grades: (body.grades ?? []).map((row) => ({
        id: String(row.id ?? ""),
        category: toCategory(row.category),
        gradeCode: String(row.gradeCode ?? ""),
        gradeName: String(row.gradeName ?? ""),
        rankOrder: toNumber(row.rankOrder),
        description: String(row.description ?? ""),
        minScore: toNumber(row.minScore),
        maxScore: toNumber(row.maxScore),
        positionId: row.positionId ? String(row.positionId) : null,
        positionName: String(row.positionName ?? ""),
      })),
      evaluationItems: (body.evaluationItems ?? []).map((row) => ({
        id: String(row.id ?? ""),
        category: toCategory(row.category),
        axis: toAxis(row.axis),
        scoreType: toScoreType(row.scoreType),
        inputScope: toInputScope(row.inputScope),
        majorCategory: String(row.majorCategory ?? ""),
        majorCategoryOrder: toNumber(row.majorCategoryOrder),
        minorCategory: String(row.minorCategory ?? ""),
        minorCategoryOrder: toNumber(row.minorCategoryOrder),
        title: String(row.title ?? ""),
        description: String(row.description ?? ""),
        weight: toNumber(row.weight),
        displayOrder: toNumber(row.displayOrder),
        isActive: Boolean(row.isActive),
        evidenceRequired: Boolean(row.evidenceRequired),
        gradeDefinitionId: row.gradeDefinitionId ? String(row.gradeDefinitionId) : null,
      })),
    });

    return NextResponse.json({
      message: result.source === "database" ? "評価制度設定を保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save skill career settings" },
      { status: 403 },
    );
  }
}
