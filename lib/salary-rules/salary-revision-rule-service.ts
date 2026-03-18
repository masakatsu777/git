import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type SalaryRevisionRuleRow = {
  id: string;
  rating: string;
  minRaise: number;
  maxRaise: number;
  defaultRaise: number;
};

export type SalaryRevisionRuleBundle = {
  evaluationPeriodId: string;
  periodName: string;
  periods: Array<{ id: string; name: string }>;
  rules: SalaryRevisionRuleRow[];
  source: "database" | "fallback";
};

export type SaveSalaryRevisionRuleInput = {
  evaluationPeriodId: string;
  rules: SalaryRevisionRuleRow[];
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function isOverallGradeCode(value: string) {
  return /^G\d+$/i.test(value);
}

const fallbackRules: SalaryRevisionRuleRow[] = [
  { id: "rule-s", rating: "S", minRaise: 6, maxRaise: 10, defaultRaise: 8 },
  { id: "rule-a", rating: "A", minRaise: 4, maxRaise: 8, defaultRaise: 6 },
  { id: "rule-b", rating: "B", minRaise: 2, maxRaise: 5, defaultRaise: 4 },
  { id: "rule-c", rating: "C", minRaise: 0, maxRaise: 3, defaultRaise: 2 },
  { id: "rule-d", rating: "D", minRaise: 0, maxRaise: 1, defaultRaise: 0 },
];

export function deriveRatingFromScore(score: number) {
  if (score >= 4.5) return "S";
  if (score >= 4.0) return "A";
  if (score >= 3.5) return "B";
  if (score >= 3.0) return "C";
  return "D";
}

function buildFallbackBundle(): SalaryRevisionRuleBundle {
  return {
    evaluationPeriodId: "period-2025-h2",
    periodName: "2025年度下期",
    periods: [{ id: "period-2025-h2", name: "2025年度下期" }],
    rules: fallbackRules,
    source: "fallback",
  };
}

export async function getSalaryRevisionRuleBundle(): Promise<SalaryRevisionRuleBundle> {
  if (!hasDatabaseUrl()) {
    return buildFallbackBundle();
  }

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
      where: { evaluationPeriodId: period.id },
      orderBy: { rating: "asc" },
    });
    const ratingRules = rules.filter((rule) => !isOverallGradeCode(rule.rating));

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      periods,
      rules: (ratingRules.length ? ratingRules : fallbackRules).map((rule) => ({
        id: rule.id,
        rating: rule.rating,
        minRaise: toNumber(rule.minRaise),
        maxRaise: toNumber(rule.maxRaise),
        defaultRaise: toNumber(rule.defaultRaise),
      })),
      source: ratingRules.length ? "database" : "fallback",
    };
  } catch {
    return buildFallbackBundle();
  }
}

export async function saveSalaryRevisionRuleBundle(input: SaveSalaryRevisionRuleInput): Promise<SalaryRevisionRuleBundle> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of input.rules) {
        const payload = {
          evaluationPeriodId: input.evaluationPeriodId,
          rating: row.rating,
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
              rating: row.rating,
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

    return getSalaryRevisionRuleBundle();
  } catch {
    return {
      evaluationPeriodId: input.evaluationPeriodId,
      periodName: "評価期間",
      periods: [{ id: input.evaluationPeriodId, name: "評価期間" }],
      rules: input.rules,
      source: "fallback",
    };
  }
}
