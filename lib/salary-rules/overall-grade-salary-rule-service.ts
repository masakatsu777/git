import { prisma } from "@/lib/prisma";
import type { SalaryRevisionRuleBundle, SalaryRevisionRuleRow } from "@/lib/salary-rules/salary-revision-rule-service";

export type SaveOverallGradeSalaryRuleInput = {
  evaluationPeriodId: string;
  rules: SalaryRevisionRuleRow[];
};

const OVERALL_GRADE_CODES = ["G1", "G2", "G3", "G4", "G5"] as const;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function normalizeOverallGradeCode(value: string) {
  return value.replace("総合", "").trim().toUpperCase();
}

const fallbackRules: SalaryRevisionRuleRow[] = [
  { id: "overall-rule-g1", rating: "G1", minRaise: 0, maxRaise: 1, defaultRaise: 0 },
  { id: "overall-rule-g2", rating: "G2", minRaise: 1, maxRaise: 2, defaultRaise: 1.5 },
  { id: "overall-rule-g3", rating: "G3", minRaise: 2, maxRaise: 4, defaultRaise: 3 },
  { id: "overall-rule-g4", rating: "G4", minRaise: 4, maxRaise: 6, defaultRaise: 5 },
  { id: "overall-rule-g5", rating: "G5", minRaise: 6, maxRaise: 9, defaultRaise: 7 },
];

function sortOverallGradeRules(rules: SalaryRevisionRuleRow[]) {
  const order = new Map<string, number>(OVERALL_GRADE_CODES.map((code, index) => [code, index]));
  return [...rules].sort((left, right) => (order.get(normalizeOverallGradeCode(left.rating)) ?? 999) - (order.get(normalizeOverallGradeCode(right.rating)) ?? 999));
}

function ensureAllOverallGrades(rules: SalaryRevisionRuleRow[]) {
  const byCode = new Map<string, SalaryRevisionRuleRow>(rules.map((rule) => [normalizeOverallGradeCode(rule.rating), rule]));
  return OVERALL_GRADE_CODES.map((code) => byCode.get(code) ?? fallbackRules.find((rule) => rule.rating === code)!).map((rule) => ({
    ...rule,
    rating: normalizeOverallGradeCode(rule.rating),
  }));
}

export async function getOverallGradeSalaryRuleBundle(): Promise<SalaryRevisionRuleBundle> {
  try {
    const periods = await prisma.evaluationPeriod.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    });

    const period = periods[0];
    if (!period) {
      throw new Error("No evaluation periods found");
    }

    const rules = await prisma.salaryRevisionRule.findMany({
      where: {
        evaluationPeriodId: period.id,
        rating: { in: [...OVERALL_GRADE_CODES] },
      },
    });

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      periods,
      rules: ensureAllOverallGrades(
        sortOverallGradeRules(
          (rules.length ? rules : fallbackRules).map((rule) => ({
            id: rule.id,
            rating: normalizeOverallGradeCode(rule.rating),
            minRaise: toNumber(rule.minRaise),
            maxRaise: toNumber(rule.maxRaise),
            defaultRaise: toNumber(rule.defaultRaise),
          })),
        ),
      ),
      source: rules.length ? "database" : "fallback",
    };
  } catch {
    return {
      evaluationPeriodId: "period-2025-h2",
      periodName: "2025年度下期",
      periods: [{ id: "period-2025-h2", name: "2025年度下期" }],
      rules: fallbackRules,
      source: "fallback",
    };
  }
}

export async function saveOverallGradeSalaryRuleBundle(input: SaveOverallGradeSalaryRuleInput): Promise<SalaryRevisionRuleBundle> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of input.rules) {
        const rating = normalizeOverallGradeCode(row.rating);
        if (!OVERALL_GRADE_CODES.includes(rating as (typeof OVERALL_GRADE_CODES)[number])) {
          continue;
        }

        const payload = {
          evaluationPeriodId: input.evaluationPeriodId,
          rating,
          minRaise: row.minRaise,
          maxRaise: row.maxRaise,
          defaultRaise: row.defaultRaise,
        };

        if (row.id && !row.id.startsWith("new-rule-")) {
          await tx.salaryRevisionRule.upsert({
            where: { id: row.id },
            update: payload,
            create: payload,
          });
          continue;
        }

        await tx.salaryRevisionRule.upsert({
          where: {
            evaluationPeriodId_rating: {
              evaluationPeriodId: input.evaluationPeriodId,
              rating,
            },
          },
          update: {
            minRaise: row.minRaise,
            maxRaise: row.maxRaise,
            defaultRaise: row.defaultRaise,
          },
          create: payload,
        });
      }
    });

    return getOverallGradeSalaryRuleBundle();
  } catch {
    return {
      evaluationPeriodId: input.evaluationPeriodId,
      periodName: "評価期間",
      periods: [{ id: input.evaluationPeriodId, name: "評価期間" }],
      rules: ensureAllOverallGrades(sortOverallGradeRules(input.rules)),
      source: "fallback",
    };
  }
}
