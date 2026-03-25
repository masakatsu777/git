import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ReviewType, SalarySimulationStatus } from "@/generated/prisma";

import { writeApprovalLog, writeAuditLog } from "@/lib/audit/log-service";
import { resolveEvaluationPeriod } from "@/lib/evaluations/period-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { deriveRatingFromScore } from "@/lib/salary-rules/salary-revision-rule-service";
import { getSalaryStructureBundle } from "@/lib/salary-structure/salary-structure-service";
import { getGradeSalarySettingBundle } from "@/lib/grade-salary/grade-salary-setting-service";
import { judgeOverallGrade } from "@/lib/skill-careers/overall-grade-service";
import { getTeamMonthlySnapshot } from "@/lib/pl/service";

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
  grossProfitMultiplier: number;
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

function roundInt(value: number) {
  return Math.round(value);
}

function calculateAxisPoints(scores: Array<{ score: unknown; evaluationItem: { axis: string; weight: unknown } }>) {
  let selfGrowthPoint = 0;
  let synergyPoint = 0;

  for (const row of scores) {
    const amount = toNumber(row.score) * toNumber(row.evaluationItem.weight) / 100;
    if (row.evaluationItem.axis === "SYNERGY") {
      synergyPoint += amount;
    } else {
      selfGrowthPoint += amount;
    }
  }

  const roundedSelfGrowthPoint = roundInt(selfGrowthPoint);
  const roundedSynergyPoint = roundInt(synergyPoint);
  return {
    selfGrowthPoint: roundedSelfGrowthPoint,
    synergyPoint: roundedSynergyPoint,
    totalGradePoint: roundedSelfGrowthPoint + roundedSynergyPoint,
  };
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

type SalaryStructureBandRef = { code: string; amount: number };

type GrossProfitAdjustmentRef = { minRate: number; maxRate: number | null; multiplier: number };

function getBandAmount(bands: SalaryStructureBandRef[], code: string) {
  return Number(bands.find((band) => band.code === code)?.amount ?? 0);
}

function resolveGrossProfitMultiplier(rows: GrossProfitAdjustmentRef[], achievementRate: number) {
  const matched = rows.find((row) => achievementRate >= row.minRate && (row.maxRate == null || achievementRate <= row.maxRate));
  return Number(matched?.multiplier ?? 1);
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
      grossProfitMultiplier: 1,
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
      grossProfitMultiplier: 1,
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
      endDate: new Date("2026-03-31T00:00:00.000Z"),
    };
  }

  return prisma.evaluationPeriod.findUniqueOrThrow({
    where: { id: period.id },
    select: { id: true, name: true, endDate: true },
  });
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

    const [salaryStructure, gradeSalarySetting, adjustmentReasonStore] = await Promise.all([
      getSalaryStructureBundle(),
      getGradeSalarySettingBundle(),
      readAdjustmentReasons(),
    ]);

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

    const yearMonth = toYearMonth(period.endDate);
    const teamSnapshotMap = new Map();
    await Promise.all(evaluations.map(async (evaluation) => {
      const key = `${evaluation.team.id}:${yearMonth}`;
      if (!teamSnapshotMap.has(key)) {
        teamSnapshotMap.set(key, await getTeamMonthlySnapshot(evaluation.team.id, yearMonth));
      }
    }));

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      rows: evaluations.map((evaluation) => {
        const currentSalary = toNumber(evaluation.user.salaryRecords[0]?.baseSalary) + toNumber(evaluation.user.salaryRecords[0]?.allowance);
        const saved = evaluation.user.salarySimulations[0];
        const finalRating = evaluation.finalRating ?? deriveRatingFromScore(toNumber(evaluation.finalScoreTotal));
        const overall = judgeOverallGrade(
          evaluation.itSkillGrade?.rankOrder ? Math.round(evaluation.itSkillGrade.rankOrder / 10) : 0,
          evaluation.businessSkillGrade?.rankOrder ? Math.round(evaluation.businessSkillGrade.rankOrder / 10) : 0,
        );
        const ruleRange = resolveRuleRange(finalRating, overall.gradeName, ratingRules, overallGradeRules);
        const selfGrowthGradeCode = `SG${evaluation.itSkillGrade?.rankOrder ? Math.round(evaluation.itSkillGrade.rankOrder / 10) : 1}`;
        const synergyGradeCode = `KG${evaluation.businessSkillGrade?.rankOrder ? Math.round(evaluation.businessSkillGrade.rankOrder / 10) : 1}`;
        const selfGrowthBaseAmount = getBandAmount(salaryStructure.selfGrowthBands, selfGrowthGradeCode);
        const synergyBaseAmount = getBandAmount(salaryStructure.synergyBands, synergyGradeCode);
        const baseSalaryReference = selfGrowthBaseAmount + synergyBaseAmount;
        const snapshot = teamSnapshotMap.get(`${evaluation.team.id}:${yearMonth}`);
        const grossProfitAchievementRate = !snapshot || Number(snapshot.targetGrossProfitRate) <= 0 ? 100 : round((Number(snapshot.actualGrossProfitRate) / Number(snapshot.targetGrossProfitRate)) * 100);
        const grossProfitMultiplier = resolveGrossProfitMultiplier(salaryStructure.grossProfitAdjustments, grossProfitAchievementRate);
        const finalSalaryReference = Math.round(baseSalaryReference * grossProfitMultiplier);
        const newSalary = saved ? toNumber(saved.newSalary) : finalSalaryReference;
        const proposedRaiseAmount = round(newSalary - currentSalary);
        const proposedRaiseRate = currentSalary === 0 ? 0 : round((proposedRaiseAmount / currentSalary) * 100);
        const points = calculateAxisPoints(evaluation.scores);
        const gradeCalculationAmount = points.totalGradePoint * gradeSalarySetting.pointUnitAmount;
        const gradeSalaryAmount = gradeSalarySetting.baseAmount + gradeCalculationAmount;

        return {
          userId: evaluation.userId,
          employeeName: evaluation.user.name,
          teamName: evaluation.team.name,
          evaluationPeriodId: period.id,
          evaluationStatus: evaluation.status,
          finalScoreTotal: toNumber(evaluation.finalScoreTotal),
          finalRating,
          overallGradeName: overall.gradeName,
          selfGrowthGradeCode,
          synergyGradeCode,
          selfGrowthBaseAmount,
          synergyBaseAmount,
          baseSalaryReference,
          grossProfitAchievementRate,
          grossProfitMultiplier,
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
          selfGrowthPoint: points.selfGrowthPoint,
          synergyPoint: points.synergyPoint,
          totalGradePoint: points.totalGradePoint,
          gradeBaseAmount: gradeSalarySetting.baseAmount,
          pointUnitAmount: gradeSalarySetting.pointUnitAmount,
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
    const auditRows: Array<{ employeeName: string; newSalary: number; diffAmount: number; adjustmentReason: string }> = [];
    await prisma.$transaction(async (tx) => {
      for (const row of input.rows) {
        const evaluation = await tx.employeeEvaluation.findUniqueOrThrow({
          where: {
            userId_evaluationPeriodId: {
              userId: row.userId,
              evaluationPeriodId: input.evaluationPeriodId,
            },
          },
          select: { id: true, user: { select: { name: true } } },
        });

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
    });

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
    await prisma.salaryRevisionSimulation.updateMany({
      where: { evaluationPeriodId: period.id },
      data: {
        status: SalarySimulationStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      },
    });
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
