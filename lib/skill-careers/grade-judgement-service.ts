import { SkillCategory } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

type GradeDefinitionRow = {
  id: string | null;
  gradeCode: string;
  gradeName: string;
  rankOrder: number;
  minScore: number;
  maxScore: number;
  positionId: string | null;
};

export type GradeJudgement = {
  score: number;
  matchedScore: number;
  gradeId: string | null;
  gradeCode: string;
  gradeName: string;
  rankOrder: number;
  nextGradeId: string | null;
  nextGradeCode: string;
  nextGradeName: string;
  nextRankOrder: number | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeScoreForDefinitions(score: number, definitions: GradeDefinitionRow[]) {
  if (definitions.length === 0) {
    return score;
  }

  const maxDefinedScore = Math.max(...definitions.map((row) => row.maxScore));
  const minDefinedScore = Math.min(...definitions.map((row) => row.minScore));
  const clampedPercent = Math.min(Math.max(score, 0), 100);

  if (maxDefinedScore <= 5) {
    return round2(1 + clampedPercent * 0.04);
  }

  if (minDefinedScore >= 1 && maxDefinedScore <= 100 && score <= 5) {
    const normalized = Math.min(Math.max(score, 1), 5);
    return round2(((normalized - 1) / 4) * 100);
  }

  return round2(Math.min(Math.max(score, minDefinedScore), maxDefinedScore));
}

function fallbackGradeDefinitions(category: SkillCategory, positionId?: string | null): GradeDefinitionRow[] {
  const commonIt = [
    { id: null, gradeCode: "SG1", gradeName: "自律成長初級", rankOrder: 10, minScore: 0, maxScore: 54.99, positionId: null },
    { id: null, gradeCode: "SG2", gradeName: "自律成長中級", rankOrder: 20, minScore: 55, maxScore: 79.99, positionId: null },
    { id: null, gradeCode: "SG3", gradeName: "自律成長上級", rankOrder: 30, minScore: 80, maxScore: 100, positionId: null },
  ];
  const commonBiz = [
    { id: null, gradeCode: "KG1", gradeName: "協調相乗初級", rankOrder: 10, minScore: 0, maxScore: 29.99, positionId: null },
    { id: null, gradeCode: "KG2", gradeName: "協調相乗中級", rankOrder: 20, minScore: 30, maxScore: 59.99, positionId: null },
    { id: null, gradeCode: "KG3", gradeName: "協調相乗上級", rankOrder: 30, minScore: 60, maxScore: 100, positionId: null },
  ];

  const base = category === SkillCategory.IT_SKILL ? commonIt : commonBiz;
  return base.filter((row) => !positionId || row.positionId === null);
}

export async function getGradeDefinitionsByCategory(category: SkillCategory, positionId?: string | null): Promise<GradeDefinitionRow[]> {
  if (!hasDatabaseUrl()) {
    return fallbackGradeDefinitions(category, positionId);
  }

  try {
    const rows = await prisma.skillGradeDefinition.findMany({
      where: {
        category,
        OR: positionId ? [{ positionId }, { positionId: null }] : [{ positionId: null }],
      },
      orderBy: [{ positionId: "desc" }, { rankOrder: "asc" }, { gradeCode: "asc" }],
      select: { id: true, gradeCode: true, gradeName: true, rankOrder: true, minScore: true, maxScore: true, positionId: true },
    });

    if (rows.length > 0) {
      const specificRows = positionId ? rows.filter((row) => row.positionId === positionId) : [];
      const targetRows = specificRows.length > 0 ? specificRows : rows.filter((row) => row.positionId === null);
      if (targetRows.length > 0) {
        return targetRows.map((row) => ({
          id: row.id,
          gradeCode: row.gradeCode,
          gradeName: row.gradeName,
          rankOrder: row.rankOrder,
          minScore: row.minScore ? Number(row.minScore) : 0,
          maxScore: row.maxScore ? Number(row.maxScore) : 0,
          positionId: row.positionId,
        }));
      }
    }
  } catch {}

  return fallbackGradeDefinitions(category, positionId);
}

export async function judgeGradeByScore(category: SkillCategory, score: number, positionId?: string | null): Promise<GradeJudgement> {
  const definitions = await getGradeDefinitionsByCategory(category, positionId);
  const normalized = normalizeScoreForDefinitions(score, definitions);
  const current = definitions.find((row) => normalized >= row.minScore && normalized <= row.maxScore) ?? definitions[0] ?? null;
  const currentIndex = current ? definitions.indexOf(current) : -1;
  const next = currentIndex >= 0 ? definitions[currentIndex + 1] ?? null : null;

  return {
    score: round2(score),
    matchedScore: normalized,
    gradeId: current?.id ?? null,
    gradeCode: current?.gradeCode ?? "-",
    gradeName: current?.gradeName ?? "未設定",
    rankOrder: current?.rankOrder ?? 0,
    nextGradeId: next?.id ?? null,
    nextGradeCode: next?.gradeCode ?? "-",
    nextGradeName: next?.gradeName ?? "なし",
    nextRankOrder: next?.rankOrder ?? null,
  };
}
