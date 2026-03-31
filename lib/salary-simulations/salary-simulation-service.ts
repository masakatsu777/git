import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ReviewType, SalarySimulationStatus } from "@/generated/prisma";

import { writeApprovalLog, writeAuditLog } from "@/lib/audit/log-service";
import { resolveEvaluationPeriod } from "@/lib/evaluations/period-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { deriveRatingFromScore } from "@/lib/salary-rules/salary-revision-rule-service";
import { getTeamMonthlySnapshot } from "@/lib/pl/service";
import { getFinalReviewBundle } from "@/lib/evaluations/final-review-service";

export type SalarySimulationRow = {
  userId: string;
  employeeName: string;
  teamName: string;
  evaluationPeriodId: string;
  evaluationStatus: string;
  finalScoreTotal: number;
  finalRating: string;
  overallGradeName: string;
  selfGrowthGradeCode: string;
  synergyGradeCode: string;
  selfGrowthBaseAmount: number;
  synergyBaseAmount: number;
  baseSalaryReference: number;
  grossProfitAchievementRate: number;
  grossProfitVarianceRate: number;
  grossProfitMultiplier: number;
  grossProfitDeductionAmount: number;
  finalSalaryReference: number;
  recommendedMinRaiseRate: number;
  recommendedMaxRaiseRate: number;
  isWithinRecommendedRange: boolean;
  currentSalary: number;
  proposedRaiseRate: number;
  proposedRaiseAmount: number;
  newSalary: number;
  adjustmentReason: string;
  status: string;
  selfGrowthPoint: number;
  synergyPoint: number;
  totalGradePoint: number;
  gradeBaseAmount: number;
  pointUnitAmount: number;
  gradeCalculationAmount: number;
  gradeSalaryAmount: number;
};

export type SalarySimulationBundle = {
  evaluationPeriodId: string;
  periodName: string;
  rows: SalarySimulationRow[];
  source: "database" | "fallback";
};

export type SalaryResultDetailBundle = {
  row: SalarySimulationRow;
  periodName: string;
  source: "database" | "fallback";
};

export type SaveSalarySimulationInput = {
  evaluationPeriodId: string;
  rows: Array<{
    userId: string;
    newSalary: number;
    adjustmentReason: string;
  }>;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

const adjustmentReasonsPath = path.join(process.cwd(), "data", "settings", "salary-simulation-adjustments.json");

function normalizeOverallGradeCode(overallGradeName: string) {
  return overallGradeName.replace("総合", "").trim().toUpperCase();
}

function toYearMonth(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

type AdjustmentReasonStore = Record<string, Record<string, string>>;

async function readAdjustmentReasons(): Promise<AdjustmentReasonStore> {
  try {
    const raw = await readFile(adjustmentReasonsPath, "utf-8");
    return JSON.parse(raw) as AdjustmentReasonStore;
  } catch {
    return {};
  }
}

async function writeAdjustmentReasons(store: AdjustmentReasonStore) {
  await mkdir(path.dirname(adjustmentReasonsPath), { recursive: true });
  await writeFile(adjustmentReasonsPath, JSON.stringify(store, null, 2), "utf-8");
}

function getAdjustmentReason(store: AdjustmentReasonStore, evaluationPeriodId: string, userId: string) {
  return String(store[evaluationPeriodId]?.[userId] ?? "").trim();
}

function buildSimulationAuditRows(rows: Array<{ employeeName: string; newSalary: number; diffAmount: number; adjustmentReason: string }>) {
  return rows.slice(0, 5).map((row) => ({
    employeeName: row.employeeName,
    newSalary: row.newSalary,
    diffAmount: row.diffAmount,
    adjustmentReason: row.adjustmentReason,
  }));
}

async function upsertSalarySimulationRows(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: { evaluationPeriodId: string; rows: Array<{ userId: string; newSalary: number; adjustmentReason: string }> },
  adjustmentReasonStore: AdjustmentReasonStore,
) {
  const auditRows: Array<{ employeeName: string; newSalary: number; diffAmount: number; adjustmentReason: string }> = [];

  for (const row of input.rows) {
    const evaluation = await tx.employeeEvaluation.findUniqueOrThrow({
      where: {
        userId_evaluationPeriodId: {
          userId: row.userId,
          evaluationPeriodId: input.evaluationPeriodId,
        },
      },
      select: {
        id: true,
        user: { select: { name: true } },
      },
    });

    const existingSimulation = await tx.salaryRevisionSimulation.findUnique({
      where: {
        userId_evaluationPeriodId: {
          userId: row.userId,
          evaluationPeriodId: input.evaluationPeriodId,
        },
      },
      select: { status: true },
    });

    if (existingSimulation && existingSimulation.status !== SalarySimulationStatus.DRAFT) {
      throw new Error(`承認済または反映済のため編集できません: ${evaluation.user.name}`);
    }

    const latestSalary = await tx.salaryRecord.findFirst({
      where: { userId: row.userId },
      orderBy: { effectiveFrom: "desc" },
      select: { baseSalary: true, allowance: true },
    });

    const currentSalary = toNumber(latestSalary?.baseSalary) + toNumber(latestSalary?.allowance);
    const newSalary = row.newSalary;
    const proposedRaiseAmount = round(newSalary - currentSalary);
    const proposedRaiseRate = currentSalary === 0 ? 0 : round((proposedRaiseAmount / currentSalary) * 100);

    await tx.salaryRevisionSimulation.upsert({
      where: {
        userId_evaluationPeriodId: {
          userId: row.userId,
          evaluationPeriodId: input.evaluationPeriodId,
        },
      },
      update: {
        currentSalary,
        proposedRaiseRate,
        proposedRaiseAmount,
        newSalary,
        status: SalarySimulationStatus.DRAFT,
        approvedBy: null,
        approvedAt: null,
      },
      create: {
        userId: row.userId,
        evaluationPeriodId: input.evaluationPeriodId,
        employeeEvaluationId: evaluation.id,
        currentSalary,
        proposedRaiseRate,
        proposedRaiseAmount,
        newSalary,
        status: SalarySimulationStatus.DRAFT,
      },
    });

    adjustmentReasonStore[input.evaluationPeriodId] ??= {};
    const normalizedReason = row.adjustmentReason.trim();
    adjustmentReasonStore[input.evaluationPeriodId][row.userId] = normalizedReason;
    auditRows.push({
      employeeName: evaluation.user.name,
      newSalary,
      diffAmount: newSalary - currentSalary,
      adjustmentReason: normalizedReason,
    });
  }

  return auditRows;
}

function resolveRuleRange(
  rating: string,
  overallGradeName: string,
  ratingRules?: Array<{ rating: string; minRaise: unknown; maxRaise: unknown }>,
  overallGradeRules?: Array<{ rating: string; minRaise: unknown; maxRaise: unknown }>,
) {
  const overallRule = overallGradeRules?.find((rule) => rule.rating === normalizeOverallGradeCode(overallGradeName));
  if (overallRule) {
    return {
      min: round(toNumber(overallRule.minRaise)),
      max: round(toNumber(overallRule.maxRaise)),
    };
  }

  const matchedRule = ratingRules?.find((rule) => rule.rating === rating);
  return {
    min: round(toNumber(matchedRule?.minRaise)),
    max: round(toNumber(matchedRule?.maxRaise)),
  };
}

function fallbackBundle(): SalarySimulationBundle {
  const rows: SalarySimulationRow[] = [
    {
      userId: "demo-member1",
      employeeName: "開発 一郎",
      teamName: "プラットフォームチーム",
      evaluationPeriodId: "period-2025-h2",
      evaluationStatus: "FINALIZED",
      finalScoreTotal: 4.0,
      finalRating: "A",
      overallGradeName: "総合G3",
      selfGrowthGradeCode: "SG3",
      synergyGradeCode: "KG2",
      selfGrowthBaseAmount: 300000,
      synergyBaseAmount: 10000,
      baseSalaryReference: 310000,
      grossProfitAchievementRate: 100,
      grossProfitVarianceRate: 0,
      grossProfitMultiplier: 1,
      grossProfitDeductionAmount: 0,
      finalSalaryReference: 310000,
      currentSalary: 390000,
      recommendedMinRaiseRate: 4,
      recommendedMaxRaiseRate: 8,
      isWithinRecommendedRange: true,
      proposedRaiseRate: 6,
      proposedRaiseAmount: 23400,
      newSalary: 413400,
      adjustmentReason: "",
      status: "DRAFT",
      selfGrowthPoint: 56,
      synergyPoint: 18,
      totalGradePoint: 74,
      gradeBaseAmount: 180000,
      pointUnitAmount: 3000,
      gradeCalculationAmount: 222000,
      gradeSalaryAmount: 402000,
    },
    {
      userId: "demo-member2",
      employeeName: "開発 二郎",
      teamName: "プラットフォームチーム",
      evaluationPeriodId: "period-2025-h2",
      evaluationStatus: "FINALIZED",
      finalScoreTotal: 4.1,
      finalRating: "A",
      overallGradeName: "総合G4",
      selfGrowthGradeCode: "SG4",
      synergyGradeCode: "KG2",
      selfGrowthBaseAmount: 350000,
      synergyBaseAmount: 10000,
      baseSalaryReference: 360000,
      grossProfitAchievementRate: 100,
      grossProfitVarianceRate: 0,
      grossProfitMultiplier: 1,
      grossProfitDeductionAmount: 0,
      finalSalaryReference: 360000,
      currentSalary: 380000,
      recommendedMinRaiseRate: 4,
      recommendedMaxRaiseRate: 8,
      isWithinRecommendedRange: true,
      proposedRaiseRate: 6,
      proposedRaiseAmount: 22800,
      newSalary: 402800,
      adjustmentReason: "",
      status: "DRAFT",
      selfGrowthPoint: 56,
      synergyPoint: 18,
      totalGradePoint: 74,
      gradeBaseAmount: 180000,
      pointUnitAmount: 3000,
      gradeCalculationAmount: 222000,
      gradeSalaryAmount: 402000,
    },
  ];

  return {
    evaluationPeriodId: "period-2025-h2",
    periodName: "2025年度下期",
    rows,
    source: "fallback",
  };
}

async function resolvePeriod(evaluationPeriodId?: string) {
  const period = await resolveEvaluationPeriod(evaluationPeriodId);

  if (!hasDatabaseUrl()) {
    return {
      id: period.id,
      name: period.name,
      startDate: new Date("2025-04-01T00:00:00.000Z"),
      endDate: new Date("2026-03-31T00:00:00.000Z"),
    };
  }

  return prisma.evaluationPeriod.findUniqueOrThrow({
    where: { id: period.id },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
}

function buildPeriodYearMonths(periodStartDate: Date, periodEndDate: Date) {
  const months: string[] = [];
  const cursor = new Date(periodStartDate.getFullYear(), periodStartDate.getMonth(), 1);
  const end = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), 1);

  while (cursor <= end) {
    months.push(toYearMonth(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function getApplyEffectiveFrom(periodEndDate: Date) {
  const nextDay = new Date(periodEndDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

export async function getSalarySimulationBundle(evaluationPeriodId?: string): Promise<SalarySimulationBundle> {
  if (!hasDatabaseUrl()) {
    const fallback = fallbackBundle();
    return evaluationPeriodId ? { ...fallback, evaluationPeriodId } : fallback;
  }

  try {
    const period = await resolvePeriod(evaluationPeriodId);

    const adjustmentReasonStore = await readAdjustmentReasons();

    const rules = await prisma.salaryRevisionRule.findMany({
      where: { evaluationPeriodId: period.id },
      select: { rating: true, minRaise: true, maxRaise: true, defaultRaise: true },
    });
    const overallGradeRules = rules.filter((rule) => /^G\d+$/i.test(String(rule.rating)));
    const ratingRules = rules.filter((rule) => !/^G\d+$/i.test(String(rule.rating)));

    const evaluations = await prisma.employeeEvaluation.findMany({
      where: { evaluationPeriodId: period.id, status: "FINALIZED" },
      orderBy: [{ team: { name: "asc" } }, { user: { name: "asc" } }],
      select: {
        userId: true,
        status: true,
        finalScoreTotal: true,
        finalRating: true,
        user: {
          select: {
            name: true,
            salaryRecords: {
              orderBy: { effectiveFrom: "desc" },
              take: 1,
              select: { baseSalary: true, allowance: true },
            },
            salarySimulations: {
              where: { evaluationPeriodId: period.id },
              take: 1,
              select: {
                proposedRaiseRate: true,
                proposedRaiseAmount: true,
                newSalary: true,
                status: true,
              },
            },
          },
        },
        team: { select: { id: true, name: true } },
        itSkillGrade: { select: { rankOrder: true } },
        businessSkillGrade: { select: { rankOrder: true } },
        scores: {
          where: { reviewType: ReviewType.FINAL },
          select: {
            score: true,
            evaluationItem: {
              select: { axis: true, weight: true },
            },
          },
        },
      },
    });

    const coveredYearMonths = buildPeriodYearMonths(period.startDate, period.endDate);
    const teamSnapshotMap = new Map();
    await Promise.all(evaluations.map(async (evaluation) => {
      const key = evaluation.team.id;
      if (!teamSnapshotMap.has(key)) {
        const existingMonths = await prisma.teamMonthlyPl.findMany({
          where: {
            teamId: evaluation.team.id,
            yearMonth: { in: coveredYearMonths },
          },
          select: { yearMonth: true },
          orderBy: { yearMonth: 'asc' },
        });
        const targetMonths = existingMonths.map((row) => row.yearMonth);
        const snapshots = await Promise.all(targetMonths.map((yearMonth) => getTeamMonthlySnapshot(evaluation.team.id, yearMonth)));
        teamSnapshotMap.set(key, snapshots);
      }
    }));

    const finalReviewEntries = await Promise.all(
      evaluations.map(async (evaluation) => [evaluation.userId, await getFinalReviewBundle(evaluation.userId, period.id)] as const),
    );
    const finalReviewMap = new Map(finalReviewEntries);

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      rows: evaluations.map((evaluation) => {
        const saved = evaluation.user.salarySimulations[0];
        const finalReview = finalReviewMap.get(evaluation.userId);
        if (!finalReview) {
          throw new Error(`最終評価結果が見つかりません: ${evaluation.userId}`);
        }

        const currentSalary = finalReview.currentSalary;
        const finalRating = finalReview.finalRating === "-"
          ? (evaluation.finalRating ?? deriveRatingFromScore(finalReview.finalScoreTotal))
          : finalReview.finalRating;
        const ruleRange = resolveRuleRange(finalRating, finalReview.overallGradeName, ratingRules, overallGradeRules);
        const selfGrowthGradeCode = `SG${Math.max(1, Math.round(finalReview.selfGrowthPoint / 10) || 1)}`;
        const synergyGradeCode = `KG${Math.max(1, Math.round(finalReview.synergyPoint / 10) || 1)}`;
        const selfGrowthBaseAmount = 0;
        const synergyBaseAmount = 0;
        const baseSalaryReference = finalReview.gradeSalaryAmount;
        const snapshots = (teamSnapshotMap.get(evaluation.team.id) ?? []) as Array<{ salesTotal: number; finalGrossProfit: number; targetGrossProfitRate: number }>;
        const periodSalesTotal = snapshots.reduce((sum, row) => sum + Number(row.salesTotal ?? 0), 0);
        const periodFinalGrossProfit = snapshots.reduce((sum, row) => sum + Number(row.finalGrossProfit ?? 0), 0);
        const periodTargetGrossProfitRate = snapshots.length > 0
          ? round(snapshots.reduce((sum, row) => sum + Number(row.targetGrossProfitRate ?? 0), 0) / snapshots.length)
          : 0;
        const periodActualGrossProfitRate = periodSalesTotal === 0 ? 0 : round((periodFinalGrossProfit / periodSalesTotal) * 100);
        const grossProfitAchievementRate = periodTargetGrossProfitRate <= 0 ? 100 : round((periodActualGrossProfitRate / periodTargetGrossProfitRate) * 100);
        const grossProfitVarianceRate = finalReview.grossProfitVarianceRate;
        const grossProfitMultiplier = 1;
        const finalSalaryReference = finalReview.gradeSalaryAmount;
        const newSalary = saved ? toNumber(saved.newSalary) : finalSalaryReference;
        const proposedRaiseAmount = round(newSalary - currentSalary);
        const proposedRaiseRate = currentSalary === 0 ? 0 : round((proposedRaiseAmount / currentSalary) * 100);
        const gradeCalculationAmount = finalReview.salaryTotalGradePoint * finalReview.pointUnitAmount;
        const gradeSalaryAmount = finalReview.gradeSalaryAmount;
        const grossProfitDeductionAmount = finalReview.grossProfitDeductionAmount;

        return {
          userId: evaluation.userId,
          employeeName: evaluation.user.name,
          teamName: evaluation.team.name,
          evaluationPeriodId: period.id,
          evaluationStatus: evaluation.status,
          finalScoreTotal: finalReview.finalScoreTotal,
          finalRating,
          overallGradeName: finalReview.overallGradeName,
          selfGrowthGradeCode,
          synergyGradeCode,
          selfGrowthBaseAmount,
          synergyBaseAmount,
          baseSalaryReference,
          grossProfitAchievementRate,
          grossProfitVarianceRate,
          grossProfitMultiplier,
          grossProfitDeductionAmount,
          finalSalaryReference,
          recommendedMinRaiseRate: ruleRange.min,
          recommendedMaxRaiseRate: ruleRange.max,
          isWithinRecommendedRange: proposedRaiseRate >= ruleRange.min && proposedRaiseRate <= ruleRange.max,
          currentSalary,
          proposedRaiseRate,
          proposedRaiseAmount,
          newSalary,
          adjustmentReason: getAdjustmentReason(adjustmentReasonStore, period.id, evaluation.userId),
          status: saved?.status ?? SalarySimulationStatus.DRAFT,
          selfGrowthPoint: finalReview.selfGrowthPoint,
          synergyPoint: finalReview.synergyPoint,
          totalGradePoint: finalReview.totalGradePoint,
          gradeBaseAmount: finalReview.gradeBaseAmount,
          pointUnitAmount: finalReview.pointUnitAmount,
          gradeCalculationAmount,
          gradeSalaryAmount,
        };
      }),
      source: "database",
    };
  } catch {
    return fallbackBundle();
  }
}

export async function saveSalarySimulationBundle(input: SaveSalarySimulationInput & { actedBy?: string }): Promise<SalarySimulationBundle> {
  try {
    const adjustmentReasonStore = await readAdjustmentReasons();
    const auditRows = await prisma.$transaction((tx) => upsertSalarySimulationRows(tx, input, adjustmentReasonStore));

    await writeAdjustmentReasons(adjustmentReasonStore);
    await writeAuditLog({
      userId: input.actedBy ?? "system",
      action: "SAVE_SALARY_SIMULATION",
      resourceType: "salary_revision_simulation",
      resourceId: input.evaluationPeriodId,
      afterJson: {
        evaluationPeriodId: input.evaluationPeriodId,
        rowCount: input.rows.length,
        adjustedCount: auditRows.filter((row) => row.diffAmount !== 0).length,
        missingReasonCount: auditRows.filter((row) => row.diffAmount !== 0 && !row.adjustmentReason).length,
        rows: buildSimulationAuditRows(auditRows),
      },
    });

    return getSalarySimulationBundle(input.evaluationPeriodId);
  } catch {
    const fallback = fallbackBundle();
    return {
      ...fallback,
      evaluationPeriodId: input.evaluationPeriodId,
      rows: fallback.rows.map((row) => {
        const saved = input.rows.find((item) => item.userId === row.userId);
        if (!saved) return row;
        return {
          ...row,
          newSalary: saved.newSalary,
          adjustmentReason: saved.adjustmentReason,
          proposedRaiseAmount: round(saved.newSalary - row.currentSalary),
          proposedRaiseRate: row.currentSalary === 0 ? 0 : round(((saved.newSalary - row.currentSalary) / row.currentSalary) * 100),
        };
      }),
      source: "fallback",
    };
  }
}

export async function approveSalarySimulationBundle(approvedBy: string, evaluationPeriodId: string): Promise<SalarySimulationBundle> {
  try {
    const period = await resolvePeriod(evaluationPeriodId);
    const bundleBeforeApprove = await getSalarySimulationBundle(evaluationPeriodId);
    const adjustmentReasonStore = await readAdjustmentReasons();
    await prisma.$transaction(async (tx) => {
      await upsertSalarySimulationRows(
        tx,
        {
          evaluationPeriodId: period.id,
          rows: bundleBeforeApprove.rows.map((row) => ({
            userId: row.userId,
            newSalary: row.newSalary,
            adjustmentReason: row.adjustmentReason,
          })),
        },
        adjustmentReasonStore,
      );
      await tx.salaryRevisionSimulation.updateMany({
        where: { evaluationPeriodId: period.id },
        data: {
          status: SalarySimulationStatus.APPROVED,
          approvedBy,
          approvedAt: new Date(),
        },
      });
    });
    await writeAdjustmentReasons(adjustmentReasonStore);
    await writeApprovalLog({
      actedBy: approvedBy,
      targetType: "salary_revision_simulation",
      targetId: period.id,
      action: "APPROVE_SALARY_SIMULATION",
      comment: `${period.name} / ${bundleBeforeApprove.rows.length}名`,
    });
    await writeAuditLog({
      userId: approvedBy,
      action: "APPROVE_SALARY_SIMULATION",
      resourceType: "salary_revision_simulation",
      resourceId: period.id,
      afterJson: {
        evaluationPeriodId: period.id,
        rowCount: bundleBeforeApprove.rows.length,
        adjustedCount: bundleBeforeApprove.rows.filter((row) => row.newSalary - row.finalSalaryReference !== 0).length,
        missingReasonCount: bundleBeforeApprove.rows.filter((row) => row.newSalary - row.finalSalaryReference !== 0 && !row.adjustmentReason).length,
        rows: buildSimulationAuditRows(bundleBeforeApprove.rows.map((row) => ({ employeeName: row.employeeName, newSalary: row.newSalary, diffAmount: row.newSalary - row.finalSalaryReference, adjustmentReason: row.adjustmentReason }))),
      },
    });
    return getSalarySimulationBundle(evaluationPeriodId);
  } catch {
    const fallback = fallbackBundle();
    return {
      ...fallback,
      evaluationPeriodId,
      rows: fallback.rows.map((row) => ({ ...row, status: SalarySimulationStatus.APPROVED })),
      source: "fallback",
    };
  }
}

export async function applySalarySimulationBundle(appliedBy: string, evaluationPeriodId: string): Promise<SalarySimulationBundle> {
  try {
    const period = await resolvePeriod(evaluationPeriodId);
    const bundleBeforeApply = await getSalarySimulationBundle(evaluationPeriodId);
    const effectiveFrom = getApplyEffectiveFrom(period.endDate);
    const simulations = await prisma.salaryRevisionSimulation.findMany({
      where: { evaluationPeriodId: period.id, status: SalarySimulationStatus.APPROVED },
      select: {
        userId: true,
        newSalary: true,
      },
    });

    await prisma.$transaction(async (tx) => {
      for (const simulation of simulations) {
        await tx.salaryRecord.upsert({
          where: {
            userId_effectiveFrom: {
              userId: simulation.userId,
              effectiveFrom,
            },
          },
          update: {
            baseSalary: simulation.newSalary,
            allowance: 0,
          },
          create: {
            userId: simulation.userId,
            effectiveFrom,
            baseSalary: simulation.newSalary,
            allowance: 0,
            socialInsurance: 0,
            otherFixedCost: 0,
          },
        });

        await tx.salaryRevisionSimulation.update({
          where: {
            userId_evaluationPeriodId: {
              userId: simulation.userId,
              evaluationPeriodId: period.id,
            },
          },
          data: { status: SalarySimulationStatus.APPLIED },
        });
      }
    });

    await writeApprovalLog({
      actedBy: appliedBy,
      targetType: "salary_revision_simulation",
      targetId: period.id,
      action: "APPLY_SALARY_SIMULATION",
      comment: `${effectiveFrom.toISOString().slice(0, 10)} / ${simulations.length}名`,
    });
    await writeAuditLog({
      userId: appliedBy,
      action: "APPLY_SALARY_SIMULATION",
      resourceType: "salary_revision_simulation",
      resourceId: period.id,
      afterJson: {
        effectiveFrom: effectiveFrom.toISOString().slice(0, 10),
        count: simulations.length,
        rowCount: bundleBeforeApply.rows.length,
        adjustedCount: bundleBeforeApply.rows.filter((row) => row.newSalary - row.finalSalaryReference !== 0).length,
        missingReasonCount: bundleBeforeApply.rows.filter((row) => row.newSalary - row.finalSalaryReference !== 0 && !row.adjustmentReason).length,
        rows: buildSimulationAuditRows(bundleBeforeApply.rows.map((row) => ({ employeeName: row.employeeName, newSalary: row.newSalary, diffAmount: row.newSalary - row.finalSalaryReference, adjustmentReason: row.adjustmentReason }))),
      },
    });

    return getSalarySimulationBundle(evaluationPeriodId);
  } catch {
    const fallback = fallbackBundle();
    return {
      ...fallback,
      evaluationPeriodId,
      rows: fallback.rows.map((row) => ({ ...row, status: SalarySimulationStatus.APPLIED })),
      source: "fallback",
    };
  }
}

export async function getSalaryResultDetailBundle(userId: string, evaluationPeriodId?: string): Promise<SalaryResultDetailBundle> {
  const bundle = await getSalarySimulationBundle(evaluationPeriodId);
  const row = bundle.rows.find((item) => item.userId === userId) ?? bundle.rows[0];
  if (!row) {
    throw new Error("昇給結果が見つかりません");
  }
  return { row, periodName: bundle.periodName, source: bundle.source };
}
