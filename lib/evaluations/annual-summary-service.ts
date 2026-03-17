import { EvaluationStatus, SalarySimulationStatus } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";

export type AnnualEvaluationPeriodSummary = {
  evaluationPeriodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  finalizedCount: number;
  totalCount: number;
  averageFinalScore: number;
  ratingCounts: Record<string, number>;
  salarySimulationStatusCounts: Record<string, number>;
  proposedRaiseAmountTotal: number;
};

export type AnnualEvaluationSummaryBundle = {
  fiscalYear: number;
  fiscalStartMonth: number;
  periods: AnnualEvaluationPeriodSummary[];
  totalEvaluatedCount: number;
  totalTargetCount: number;
  averageFinalScore: number;
  ratingCounts: Record<string, number>;
  proposedRaiseAmountTotal: number;
  approvedRaiseAmountTotal: number;
  appliedRaiseAmountTotal: number;
  source: "database" | "fallback";
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function createDateRange(fiscalYear: number, fiscalStartMonth: number) {
  const start = new Date(Date.UTC(fiscalYear, fiscalStartMonth - 1, 1));
  const endMonthIndex = fiscalStartMonth - 2;
  const endYear = endMonthIndex >= 0 ? fiscalYear + 1 : fiscalYear;
  const normalizedEndMonthIndex = endMonthIndex >= 0 ? endMonthIndex : 11;
  const end = new Date(Date.UTC(endYear, normalizedEndMonthIndex + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function isOverlapping(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA <= endB && endA >= startB;
}

function buildFallbackBundle(fiscalYear: number, fiscalStartMonth: number): AnnualEvaluationSummaryBundle {
  return {
    fiscalYear,
    fiscalStartMonth,
    periods: [
      {
        evaluationPeriodId: "period-2025-h1",
        periodName: `${fiscalYear}年度上期`,
        startDate: `${fiscalYear}-04-01`,
        endDate: `${fiscalYear}-09-30`,
        finalizedCount: 14,
        totalCount: 18,
        averageFinalScore: 3.86,
        ratingCounts: { S: 1, A: 5, B: 6, C: 2, D: 0 },
        salarySimulationStatusCounts: { DRAFT: 6, APPROVED: 4, APPLIED: 4 },
        proposedRaiseAmountTotal: 186000,
      },
      {
        evaluationPeriodId: "period-2025-h2",
        periodName: `${fiscalYear}年度下期`,
        startDate: `${fiscalYear}-10-01`,
        endDate: `${fiscalYear + 1}-03-31`,
        finalizedCount: 12,
        totalCount: 18,
        averageFinalScore: 3.74,
        ratingCounts: { S: 0, A: 4, B: 5, C: 3, D: 0 },
        salarySimulationStatusCounts: { DRAFT: 8, APPROVED: 2, APPLIED: 2 },
        proposedRaiseAmountTotal: 142000,
      },
    ],
    totalEvaluatedCount: 26,
    totalTargetCount: 36,
    averageFinalScore: 3.8,
    ratingCounts: { S: 1, A: 9, B: 11, C: 5, D: 0 },
    proposedRaiseAmountTotal: 328000,
    approvedRaiseAmountTotal: 148000,
    appliedRaiseAmountTotal: 148000,
    source: "fallback",
  };
}

export async function getAnnualEvaluationSummaryBundle(fiscalYear: number, fiscalStartMonth: number, teamIds?: string[]): Promise<AnnualEvaluationSummaryBundle> {
  try {
    const range = createDateRange(fiscalYear, fiscalStartMonth);
    const periods = await prisma.evaluationPeriod.findMany({
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        employeeEvaluations: {
          where: teamIds && teamIds.length > 0 ? { teamId: { in: teamIds } } : undefined,
          select: {
            status: true,
            finalScoreTotal: true,
            finalRating: true,
          },
        },
        salarySimulations: {
          select: {
            status: true,
            proposedRaiseAmount: true,
          },
        },
      },
    });

    const filteredPeriods = periods.filter((period) => isOverlapping(period.startDate, period.endDate, range.start, range.end));

    const summaries = filteredPeriods.map((period) => {
      const finalized = period.employeeEvaluations.filter((evaluation) => evaluation.status === EvaluationStatus.FINALIZED && evaluation.finalScoreTotal !== null);
      const ratingCounts = finalized.reduce<Record<string, number>>((counts, evaluation) => {
        const rating = evaluation.finalRating ?? "-";
        counts[rating] = (counts[rating] ?? 0) + 1;
        return counts;
      }, {});
      const salarySimulationStatusCounts = period.salarySimulations.reduce<Record<string, number>>((counts, simulation) => {
        const key = simulation.status;
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {});
      const proposedRaiseAmountTotal = period.salarySimulations.reduce((sum, simulation) => sum + Number(simulation.proposedRaiseAmount), 0);

      return {
        evaluationPeriodId: period.id,
        periodName: period.name,
        startDate: period.startDate.toISOString().slice(0, 10),
        endDate: period.endDate.toISOString().slice(0, 10),
        finalizedCount: finalized.length,
        totalCount: period.employeeEvaluations.length,
        averageFinalScore: finalized.length > 0 ? round2(finalized.reduce((sum, evaluation) => sum + Number(evaluation.finalScoreTotal), 0) / finalized.length) : 0,
        ratingCounts,
        salarySimulationStatusCounts,
        proposedRaiseAmountTotal,
      };
    });

    const allFinalized = summaries.reduce((sum, period) => sum + period.finalizedCount, 0);
    const allTargets = summaries.reduce((sum, period) => sum + period.totalCount, 0);
    const weightedScoreTotal = summaries.reduce((sum, period) => sum + period.averageFinalScore * period.finalizedCount, 0);
    const ratingCounts = summaries.reduce<Record<string, number>>((counts, period) => {
      Object.entries(period.ratingCounts).forEach(([rating, count]) => {
        counts[rating] = (counts[rating] ?? 0) + count;
      });
      return counts;
    }, {});

    const proposedRaiseAmountTotal = summaries.reduce((sum, period) => sum + period.proposedRaiseAmountTotal, 0);
    const approvedRaiseAmountTotal = filteredPeriods.reduce((sum, period) => {
      return sum + period.salarySimulations.filter((simulation) => simulation.status === SalarySimulationStatus.APPROVED).reduce((inner, simulation) => inner + Number(simulation.proposedRaiseAmount), 0);
    }, 0);
    const appliedRaiseAmountTotal = filteredPeriods.reduce((sum, period) => {
      return sum + period.salarySimulations.filter((simulation) => simulation.status === SalarySimulationStatus.APPLIED).reduce((inner, simulation) => inner + Number(simulation.proposedRaiseAmount), 0);
    }, 0);

    return {
      fiscalYear,
      fiscalStartMonth,
      periods: summaries,
      totalEvaluatedCount: allFinalized,
      totalTargetCount: allTargets,
      averageFinalScore: allFinalized > 0 ? round2(weightedScoreTotal / allFinalized) : 0,
      ratingCounts,
      proposedRaiseAmountTotal,
      approvedRaiseAmountTotal,
      appliedRaiseAmountTotal,
      source: "database",
    };
  } catch {
    return buildFallbackBundle(fiscalYear, fiscalStartMonth);
  }
}
