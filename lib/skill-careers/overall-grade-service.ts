export type OverallGradeJudgement = {
  level: number;
  gradeCode: string;
  gradeName: string;
};

const OVERALL_GRADE_MATRIX: Record<number, Record<number, number>> = {
  1: { 1: 1, 2: 1, 3: 2 },
  2: { 1: 2, 2: 3, 3: 4 },
  3: { 1: 3, 2: 4, 3: 5 },
};

function normalizeLevel(level: number | null | undefined) {
  if (!level || level < 1) {
    return 0;
  }
  return Math.min(3, Math.round(level));
}

export function judgeOverallGrade(selfGrowthLevel: number | null | undefined, synergyLevel: number | null | undefined): OverallGradeJudgement {
  const normalizedSelfGrowth = normalizeLevel(selfGrowthLevel);
  const normalizedSynergy = normalizeLevel(synergyLevel);

  if (normalizedSelfGrowth === 0 || normalizedSynergy === 0) {
    return {
      level: 0,
      gradeCode: "-",
      gradeName: "未判定",
    };
  }

  const level = OVERALL_GRADE_MATRIX[normalizedSelfGrowth]?.[normalizedSynergy] ?? normalizedSelfGrowth;
  return {
    level,
    gradeCode: 'G' + level,
    gradeName: '総合G' + level,
  };
}
