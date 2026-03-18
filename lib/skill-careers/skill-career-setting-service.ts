import { SkillCategory } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type EvaluationAxis = "SELF_GROWTH" | "SYNERGY";
export type EvaluationScoreType = "LEVEL_2" | "CONTINUOUS_DONE";

export type SkillGradeRow = {
  id: string;
  category: SkillCategory;
  gradeCode: string;
  gradeName: string;
  rankOrder: number;
  description: string;
  minScore: number;
  maxScore: number;
  positionId: string | null;
  positionName: string;
};

export type EvaluationItemRow = {
  id: string;
  category: SkillCategory;
  axis: EvaluationAxis;
  scoreType: EvaluationScoreType;
  majorCategory: string;
  majorCategoryOrder: number;
  minorCategory: string;
  minorCategoryOrder: number;
  title: string;
  description: string;
  weight: number;
  displayOrder: number;
  isActive: boolean;
  evidenceRequired: boolean;
  gradeDefinitionId: string | null;
};

export type PositionOptionRow = {
  id: string;
  code: string;
  name: string;
};

export type SkillCareerSettingsBundle = {
  grades: SkillGradeRow[];
  evaluationItems: EvaluationItemRow[];
  positions: PositionOptionRow[];
  source: "database" | "fallback";
};

export type SaveSkillCareerSettingsInput = {
  grades: SkillGradeRow[];
  evaluationItems: EvaluationItemRow[];
};

const fallbackBundle: SkillCareerSettingsBundle = {
  grades: [
    {
      id: "grade-it-s1",
      category: SkillCategory.IT_SKILL,
      gradeCode: "SG1",
      gradeName: "自律成長初級",
      rankOrder: 10,
      description: "基本的な業務を実行しながら成長できる",
      minScore: 1,
      maxScore: 2.32,
      positionId: null,
      positionName: "全職種共通",
    },
    {
      id: "grade-it-s2",
      category: SkillCategory.IT_SKILL,
      gradeCode: "SG2",
      gradeName: "自律成長中級",
      rankOrder: 20,
      description: "自律的に業務を進め、周囲へ良い影響を与えられる",
      minScore: 2.33,
      maxScore: 3.66,
      positionId: null,
      positionName: "全職種共通",
    },
    {
      id: "grade-biz-b1",
      category: SkillCategory.BUSINESS_SKILL,
      gradeCode: "KG1",
      gradeName: "協調相乗初級",
      rankOrder: 10,
      description: "継続実践は限定的だが、協調相乗の動きが見え始めている",
      minScore: 1,
      maxScore: 2.32,
      positionId: null,
      positionName: "全職種共通",
    },
  ],
  evaluationItems: [
    {
      id: "item-it-foundation",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル: 基礎理解",
      majorCategoryOrder: 10,
      minorCategory: "基礎理解",
      minorCategoryOrder: 10,
      title: "使用技術や業務知識の基礎を理解している",
      description: "自ら学び、仕事を通じて必要とされる存在になるための基礎理解を確認する",
      weight: 20,
      displayOrder: 1,
      isActive: true,
      evidenceRequired: false,
      gradeDefinitionId: null,
    },
    {
      id: "item-it-design",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル: 設計",
      majorCategoryOrder: 20,
      minorCategory: "設計",
      minorCategoryOrder: 10,
      title: "要件や仕様を踏まえて設計方針を整理できる",
      description: "要件を構造化し、実装へつながる設計に落とし込めるかを確認する",
      weight: 20,
      displayOrder: 2,
      isActive: true,
      evidenceRequired: false,
      gradeDefinitionId: null,
    },
    {
      id: "item-it-implementation",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル: 実装",
      majorCategoryOrder: 30,
      minorCategory: "実装",
      minorCategoryOrder: 10,
      title: "読みやすく保守しやすいコードを書ける",
      description: "保守性を意識した実装ができるかを確認する",
      weight: 20,
      displayOrder: 3,
      isActive: true,
      evidenceRequired: false,
      gradeDefinitionId: null,
    },
    {
      id: "item-it-quality",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル: テスト・品質",
      majorCategoryOrder: 40,
      minorCategory: "テスト・品質",
      minorCategoryOrder: 10,
      title: "必要なテスト観点を洗い出し品質を担保できる",
      description: "テスト観点と品質確保の基本ができているかを確認する",
      weight: 20,
      displayOrder: 4,
      isActive: true,
      evidenceRequired: false,
      gradeDefinitionId: null,
    },
    {
      id: "item-it-operations",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル: 運用保守",
      majorCategoryOrder: 50,
      minorCategory: "運用保守",
      minorCategoryOrder: 10,
      title: "既存システムを理解し安全に改修できる",
      description: "運用保守の視点を持って安定した改修ができるかを確認する",
      weight: 20,
      displayOrder: 5,
      isActive: true,
      evidenceRequired: false,
      gradeDefinitionId: null,
    },
    {
      id: "item-synergy-team",
      category: SkillCategory.BUSINESS_SKILL,
      axis: "SYNERGY",
      scoreType: "CONTINUOUS_DONE",
      majorCategory: "育成支援力",
      majorCategoryOrder: 10,
      minorCategory: "レビュー支援",
      minorCategoryOrder: 10,
      title: "レビューや伴走を通じて他者の成長支援を継続して行っている",
      description: "単発ではなく、半期を通じた継続実践かどうかを確認する",
      weight: 20,
      displayOrder: 2,
      isActive: true,
      evidenceRequired: true,
      gradeDefinitionId: null,
    },
  ],
  positions: [
    { id: "", code: "common", name: "全職種共通" },
    { id: "pos-engineer", code: "member", name: "メンバー" },
    { id: "pos-leader", code: "leader", name: "リーダー" },
  ],
  source: "fallback",
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

const META_PREFIX = "__EVAL_META__";

type EvaluationItemStoredMeta = {
  majorCategoryOrder?: number;
  minorCategoryOrder?: number;
};

function parseEvaluationItemDescription(description: string | null | undefined, displayOrder: number) {
  if (!description || !description.startsWith(META_PREFIX)) {
    return {
      description: description ?? "",
      majorCategoryOrder: displayOrder,
      minorCategoryOrder: displayOrder,
    };
  }

  const newLineIndex = description.indexOf("\n");
  const metaPayload = newLineIndex >= 0 ? description.slice(META_PREFIX.length, newLineIndex) : description.slice(META_PREFIX.length);
  const visibleDescription = newLineIndex >= 0 ? description.slice(newLineIndex + 1) : "";

  try {
    const parsed = JSON.parse(metaPayload) as EvaluationItemStoredMeta;
    return {
      description: visibleDescription,
      majorCategoryOrder: toNumber(parsed.majorCategoryOrder ?? displayOrder),
      minorCategoryOrder: toNumber(parsed.minorCategoryOrder ?? displayOrder),
    };
  } catch {
    return {
      description,
      majorCategoryOrder: displayOrder,
      minorCategoryOrder: displayOrder,
    };
  }
}

function buildEvaluationItemDescription(row: EvaluationItemRow) {
  const meta: EvaluationItemStoredMeta = {
    majorCategoryOrder: row.majorCategoryOrder,
    minorCategoryOrder: row.minorCategoryOrder,
  };
  return `${META_PREFIX}${JSON.stringify(meta)}\n${row.description || ""}`;
}

export async function getSkillCareerSettingsBundle(): Promise<SkillCareerSettingsBundle> {
  if (!hasDatabaseUrl()) {
    return fallbackBundle;
  }

  try {
    const [grades, evaluationItems, positions] = await Promise.all([
      prisma.skillGradeDefinition.findMany({
        orderBy: [{ category: "asc" }, { positionId: "asc" }, { rankOrder: "asc" }, { gradeCode: "asc" }],
        include: { position: { select: { id: true, name: true, code: true } } },
      }),
      prisma.evaluationItem.findMany({
        orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { title: "asc" }],
      }),
      prisma.position.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      }),
    ]);

    return {
      grades: grades.map((grade) => ({
        id: grade.id,
        category: grade.category,
        gradeCode: grade.gradeCode,
        gradeName: grade.gradeName,
        rankOrder: grade.rankOrder,
        description: grade.description ?? "",
        minScore: grade.minScore ? toNumber(grade.minScore) : 0,
        maxScore: grade.maxScore ? toNumber(grade.maxScore) : 0,
        positionId: grade.positionId,
        positionName: grade.position?.name ?? "全職種共通",
      })),
      evaluationItems: evaluationItems.map((item) => {
        const parsedDescription = parseEvaluationItemDescription(item.description, item.displayOrder);
        return {
          id: item.id,
          category: item.category,
          axis: item.axis,
          scoreType: item.scoreType,
          majorCategory: item.majorCategory,
          majorCategoryOrder: parsedDescription.majorCategoryOrder,
          minorCategory: item.minorCategory,
          minorCategoryOrder: parsedDescription.minorCategoryOrder,
          title: item.title,
          description: parsedDescription.description,
          weight: toNumber(item.weight),
          displayOrder: item.displayOrder,
          isActive: item.isActive,
          evidenceRequired: item.evidenceRequired,
          gradeDefinitionId: item.gradeDefinitionId,
        };
      }),
      positions: [{ id: "", code: "common", name: "全職種共通" }, ...positions],
      source: "database",
    };
  } catch {
    return fallbackBundle;
  }
}

export async function saveSkillCareerSettingsBundle(input: SaveSkillCareerSettingsInput): Promise<SkillCareerSettingsBundle> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of input.grades) {
        const payload = {
          category: row.category,
          gradeCode: row.gradeCode,
          gradeName: row.gradeName,
          rankOrder: row.rankOrder,
          description: row.description || null,
          minScore: row.minScore || null,
          maxScore: row.maxScore || null,
          positionId: row.positionId || null,
        };

        if (row.id && !row.id.startsWith("new-grade-")) {
          await tx.skillGradeDefinition.upsert({
            where: { id: row.id },
            update: payload,
            create: payload,
          });
          continue;
        }

        await tx.skillGradeDefinition.create({
          data: payload,
        });
      }

      for (const row of input.evaluationItems) {
        const payload = {
          category: row.category,
          axis: row.axis,
          scoreType: row.scoreType,
          majorCategory: row.majorCategory,
          minorCategory: row.minorCategory,
          title: row.title,
          description: buildEvaluationItemDescription(row),
          weight: row.weight,
          displayOrder: row.displayOrder,
          isActive: row.isActive,
          evidenceRequired: row.evidenceRequired,
          gradeDefinitionId: row.gradeDefinitionId || null,
        };

        if (row.id && !row.id.startsWith("new-item-")) {
          await tx.evaluationItem.update({
            where: { id: row.id },
            data: payload,
          });
          continue;
        }

        await tx.evaluationItem.create({
          data: payload,
        });
      }
    });

    return getSkillCareerSettingsBundle();
  } catch {
    return {
      grades: input.grades,
      evaluationItems: input.evaluationItems,
      positions: fallbackBundle.positions,
      source: "fallback",
    };
  }
}
