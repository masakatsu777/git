import { EvaluationPeriodStatus, EvaluationStatus, ReviewType, SkillCategory } from "@/generated/prisma";

import { writeApprovalLog, writeAuditLog } from "@/lib/audit/log-service";
import { resolveEvaluationPeriod } from "@/lib/evaluations/period-service";
import {
  resolveStoredItemMetaFromRow,
  type EvaluationEvidence,
  type SelfReviewAxis,
  type SelfReviewScoreType,
} from "@/lib/evaluations/self-review-service";
import { getUserMenuVisibilityMap } from "@/lib/menu-visibility/menu-visibility-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { deriveRatingFromScore } from "@/lib/salary-rules/salary-revision-rule-service";
import { judgeGradeByScore } from "@/lib/skill-careers/grade-judgement-service";
import { judgeOverallGrade } from "@/lib/skill-careers/overall-grade-service";
import { getGradeSalarySettingBundle } from "@/lib/grade-salary/grade-salary-setting-service";
import { decodeManagerOverallComment } from "@/lib/evaluations/manager-review-service";

export type FinalReviewMember = {
  userId: string;
  name: string;
  teamName: string;
  status: string;
  selfScoreTotal: number;
  managerScoreTotal: number;
  finalScoreTotal: number;
  finalRating: string;
  overallGradeName: string;
  itSkillGradeName: string;
  businessSkillGradeName: string;
};

export type FinalReviewItem = {
  evaluationItemId: string;
  title: string;
  category: "IT_SKILL" | "BUSINESS_SKILL";
  axis: SelfReviewAxis;
  scoreType: SelfReviewScoreType;
  majorCategory: string;
  minorCategory: string;
  weight: number;
  maxScore: number;
  selfScore: number;
  managerScore: number;
  finalScore: number;
  selfComment: string;
  managerComment: string;
  finalComment: string;
  evidenceRequired: boolean;
  evidences: EvaluationEvidence[];
  inputScope: "SELF" | "MANAGER" | "ADMIN" | "BOTH";
};

export type FinalReviewDisplayStage = "SELF" | "MANAGER" | "FINAL";

export type FinalReviewBundle = {
  evaluationPeriodId: string;
  periodName: string;
  periodStatus: EvaluationPeriodStatus;
  members: FinalReviewMember[];
  selectedUserId: string;
  selectedUserName: string;
  teamName: string;
  positionName: string;
  status: string;
  displayStage: FinalReviewDisplayStage;
  selfComment: string;
  managerComment: string;
  finalComment: string;
  selfScoreTotal: number;
  managerScoreTotal: number;
  finalScoreTotal: number;
  finalRating: string;
  overallGradeName: string;
  selfGrowthProgress: number;
  selfGrowthPoint: number;
  synergyPoint: number;
  totalGradePoint: number;
  salarySelfGrowthPoint: number;
  salarySynergyPoint: number;
  salaryTotalGradePoint: number;
  gradeBaseAmount: number;
  pointUnitAmount: number;
  gradeSalaryAmount: number;
  currentSalary: number;
  synergyProgress: number;
  itSkillScore: number;
  businessSkillScore: number;
  itSkillGradeName: string;
  businessSkillGradeName: string;
  nextItSkillGradeName: string;
  nextBusinessSkillGradeName: string;
  items: FinalReviewItem[];
  source: "database" | "fallback";
};

export type SaveFinalReviewInput = {
  evaluationPeriodId: string;
  userId: string;
  finalComment: string;
  items: Array<{
    evaluationItemId: string;
    score: number;
    comment: string;
    evidences?: EvaluationEvidence[];
  }>;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeLevel2Score(rawScore: number) {
  if (rawScore >= 2) return 2;
  if (rawScore >= 1) return 1;
  return 0;
}

function normalizeContinuousDoneScore(rawScore: number) {
  return rawScore >= 1 ? 1 : 0;
}

function normalizeScore(rawScore: number, scoreType: SelfReviewScoreType) {
  return scoreType === "LEVEL_2" ? normalizeLevel2Score(rawScore) : normalizeContinuousDoneScore(rawScore);
}

function normalizeEvidences(evidences?: Array<EvaluationEvidence | { id?: string; summary: string; targetName: string | null; periodNote: string | null }>) {
  return (evidences ?? [])
    .map((evidence) => ({
      id: evidence.id,
      summary: String(evidence.summary ?? "").trim(),
      targetName: String(evidence.targetName ?? "").trim(),
      periodNote: String(evidence.periodNote ?? "").trim(),
    }))
    .filter((evidence) => evidence.summary || evidence.targetName || evidence.periodNote);
}

function calculateTotal(items: Array<{ score: number; weight: number }>) {
  return round2(items.reduce((sum, item) => sum + item.score * item.weight, 0));
}

function resolveDisplayStage(status: string): FinalReviewDisplayStage {
  switch (status) {
    case EvaluationStatus.FINALIZED:
      return "FINAL";
    case EvaluationStatus.MANAGER_REVIEW:
    case EvaluationStatus.FINAL_REVIEW:
      return "MANAGER";
    case EvaluationStatus.SELF_REVIEW:
    default:
      return "SELF";
  }
}

function resolveDisplayedFinalRating(managerComment: string | null | undefined, storedFinalRating: string | null | undefined, displayStage: FinalReviewDisplayStage, totalScore: number) {
  const managerMeta = decodeManagerOverallComment(managerComment);
  if (displayStage !== "FINAL" && managerMeta.expectedFulfillmentRank) {
    return managerMeta.expectedFulfillmentRank;
  }
  if (storedFinalRating) {
    return storedFinalRating;
  }
  if (managerMeta.expectedFulfillmentRank) {
    return managerMeta.expectedFulfillmentRank;
  }
  return totalScore > 0 ? deriveRatingFromScore(totalScore) : "-";
}

function getProgressTargetItems(items: FinalReviewItem[], axis: SelfReviewAxis) {
  return items.filter((item) => item.axis === axis && item.inputScope !== "MANAGER" && item.inputScope !== "ADMIN");
}

function getDisplayScore(item: Pick<FinalReviewItem, "selfScore" | "managerScore" | "finalScore">, stage: FinalReviewDisplayStage) {
  switch (stage) {
    case "FINAL":
      return item.finalScore;
    case "MANAGER":
      return item.managerScore;
    case "SELF":
    default:
      return item.selfScore;
  }
}

function calculateAxisPoints(items: FinalReviewItem[], stage: FinalReviewDisplayStage) {
  let selfGrowthPoint = 0;
  let synergyPoint = 0;

  for (const item of items.filter((row) => row.inputScope !== "MANAGER" && row.inputScope !== "ADMIN")) {
    const amount = getDisplayScore(item, stage) * item.weight;
    if (item.axis === "SYNERGY") {
      synergyPoint += amount;
    } else {
      selfGrowthPoint += amount;
    }
  }

  const roundedSelfGrowthPoint = Math.round(selfGrowthPoint);
  const roundedSynergyPoint = Math.round(synergyPoint);
  return {
    selfGrowthPoint: roundedSelfGrowthPoint,
    synergyPoint: roundedSynergyPoint,
    totalGradePoint: roundedSelfGrowthPoint + roundedSynergyPoint,
  };
}

function calculateSalaryAxisPoints(items: FinalReviewItem[], stage: FinalReviewDisplayStage) {
  let selfGrowthPoint = 0;
  let synergyPoint = 0;

  for (const item of items) {
    const amount = getDisplayScore(item, stage) * item.weight;
    if (item.axis === "SYNERGY") {
      synergyPoint += amount;
    } else {
      selfGrowthPoint += amount;
    }
  }

  const roundedSelfGrowthPoint = Math.round(selfGrowthPoint);
  const roundedSynergyPoint = Math.round(synergyPoint);
  return {
    salarySelfGrowthPoint: roundedSelfGrowthPoint,
    salarySynergyPoint: roundedSynergyPoint,
    salaryTotalGradePoint: roundedSelfGrowthPoint + roundedSynergyPoint,
  };
}

function calculateProgress(items: FinalReviewItem[], axis: SelfReviewAxis, stage: FinalReviewDisplayStage) {
  const targetItems = getProgressTargetItems(items, axis);
  if (targetItems.length === 0) return 0;
  const achieved = targetItems.reduce((sum, item) => sum + getDisplayScore(item, stage) * item.weight, 0);
  const possible = targetItems.reduce((sum, item) => sum + item.maxScore * item.weight, 0);
  if (possible === 0) return 0;
  return round2((achieved / possible) * 100);
}

function calculateAxisMetric(items: FinalReviewItem[], axis: SelfReviewAxis, stage: FinalReviewDisplayStage) {
  const targetItems = getProgressTargetItems(items, axis);
  if (targetItems.length === 0) return 0;
  const achieved = targetItems.reduce((sum, item) => sum + getDisplayScore(item, stage) * item.weight, 0);
  const possible = targetItems.reduce((sum, item) => sum + item.maxScore * item.weight, 0);
  if (possible === 0) return 0;
  return round2((achieved / possible) * 100);
}

async function enrichWithGradeJudgement(items: FinalReviewItem[], stage: FinalReviewDisplayStage, positionId?: string | null) {
  const itSkillScore = calculateAxisMetric(items, "SELF_GROWTH", stage);
  const businessSkillScore = calculateAxisMetric(items, "SYNERGY", stage);
  const [itSkill, businessSkill] = await Promise.all([
    judgeGradeByScore(SkillCategory.IT_SKILL, itSkillScore, positionId),
    judgeGradeByScore(SkillCategory.BUSINESS_SKILL, businessSkillScore, positionId),
  ]);

  const overall = judgeOverallGrade(itSkill.rankOrder ? Math.round(itSkill.rankOrder / 10) : 0, businessSkill.rankOrder ? Math.round(businessSkill.rankOrder / 10) : 0);

  return {
    itSkillScore,
    businessSkillScore,
    itSkill,
    businessSkill,
    overall,
  };
}

async function buildFallbackBundle(selectedUserId?: string): Promise<FinalReviewBundle> {
  const members: FinalReviewMember[] = [
    { userId: "demo-member1", name: "開発 一郎", teamName: "プラットフォームチーム", status: "MANAGER_REVIEW", selfScoreTotal: 1.15, managerScoreTotal: 1.24, finalScoreTotal: 0, finalRating: "-", overallGradeName: "総合G2", itSkillGradeName: "自律成長中級", businessSkillGradeName: "協調相乗初級" },
    { userId: "demo-member2", name: "開発 二郎", teamName: "プラットフォームチーム", status: "FINAL_REVIEW", selfScoreTotal: 1.38, managerScoreTotal: 1.42, finalScoreTotal: 1.42, finalRating: "B", overallGradeName: "総合G4", itSkillGradeName: "自律成長上級", businessSkillGradeName: "協調相乗中級" },
  ];
  const target = members.find((member) => member.userId === selectedUserId) ?? members[0];
  const items: FinalReviewItem[] = [
    {
      evaluationItemId: "item-it-foundation",
      title: "使用技術や業務知識の基礎を理解している",
      category: "IT_SKILL",
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル",
      minorCategory: "基礎理解",
      weight: 25,
      maxScore: 2,
      selfScore: 0,
      managerScore: 0,
      finalScore: 0,
      selfComment: "",
      managerComment: "",
      finalComment: "",
      evidenceRequired: false,
      evidences: [],
      inputScope: "BOTH",
    },
    {
      evaluationItemId: "item-it-implementation",
      title: "設計意図を理解して実装へ落とし込める",
      category: "IT_SKILL",
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル",
      minorCategory: "実装",
      weight: 25,
      maxScore: 2,
      selfScore: 0,
      managerScore: 0,
      finalScore: 0,
      selfComment: "",
      managerComment: "",
      finalComment: "",
      evidenceRequired: false,
      evidences: [],
      inputScope: "BOTH",
    },
    {
      evaluationItemId: "item-synergy-customer",
      title: "関係深化や追加提案につながる行動を継続して行っている",
      category: "BUSINESS_SKILL",
      axis: "SYNERGY",
      scoreType: "CONTINUOUS_DONE",
      majorCategory: "顧客拡張力",
      minorCategory: "関係深化",
      weight: 8,
      maxScore: 1,
      selfScore: 0,
      managerScore: 1,
      finalScore: 1,
      selfComment: "定例対話で追加相談を拾う動きを始めた。",
      managerComment: "追加提案につながる対話が継続している。",
      finalComment: "継続実践として認められる。",
      evidenceRequired: true,
      evidences: [],
      inputScope: "BOTH",
    },
    {
      evaluationItemId: "item-synergy-team",
      title: "レビューや伴走を通じて他者の成長支援を継続して行っている",
      category: "BUSINESS_SKILL",
      axis: "SYNERGY",
      scoreType: "CONTINUOUS_DONE",
      majorCategory: "育成支援力",
      minorCategory: "レビュー支援",
      weight: 7,
      maxScore: 1,
      selfScore: 1,
      managerScore: 1,
      finalScore: 1,
      selfComment: "レビュー支援を継続して行った。",
      managerComment: "伴走支援が継続している。",
      finalComment: "継続実践できている。",
      evidenceRequired: true,
      evidences: [],
      inputScope: "BOTH",
    },
  ];
  const displayStage = resolveDisplayStage(target.status);
  const judgement = await enrichWithGradeJudgement(items, displayStage, null);
  const points = calculateAxisPoints(items, displayStage);
  const salaryPoints = calculateSalaryAxisPoints(items, displayStage);
  const gradeSalarySetting = await getGradeSalarySettingBundle();
  const gradeSalaryAmount = gradeSalarySetting.baseAmount + salaryPoints.salaryTotalGradePoint * gradeSalarySetting.pointUnitAmount;
  const finalTotal = calculateTotal(items.map((item) => ({ score: getDisplayScore(item, displayStage), weight: item.weight })));

  return {
    evaluationPeriodId: "period-2025-h2",
    periodName: "2025年度下期",
    periodStatus: EvaluationPeriodStatus.CLOSED,
    members,
    selectedUserId: target.userId,
    selectedUserName: target.name,
    teamName: target.teamName,
    positionName: "メンバー",
    status: target.status,
    displayStage,
    selfComment: "自律成長と継続実践の両面を整理する。",
    managerComment: decodeManagerOverallComment("半期を通じて安定した実践が見られました。").comment,
    finalComment: "次期は継続実践の広がりも期待します。",
    selfScoreTotal: target.selfScoreTotal,
    managerScoreTotal: target.managerScoreTotal,
    finalScoreTotal: finalTotal,
    finalRating: resolveDisplayedFinalRating(undefined, undefined, displayStage, finalTotal),
    overallGradeName: judgement.overall.gradeName,
    selfGrowthProgress: calculateProgress(items, "SELF_GROWTH", displayStage),
    synergyProgress: calculateProgress(items, "SYNERGY", displayStage),
    selfGrowthPoint: points.selfGrowthPoint,
    synergyPoint: points.synergyPoint,
    totalGradePoint: points.totalGradePoint,
    salarySelfGrowthPoint: salaryPoints.salarySelfGrowthPoint,
    salarySynergyPoint: salaryPoints.salarySynergyPoint,
    salaryTotalGradePoint: salaryPoints.salaryTotalGradePoint,
    gradeBaseAmount: gradeSalarySetting.baseAmount,
    pointUnitAmount: gradeSalarySetting.pointUnitAmount,
    gradeSalaryAmount,
    currentSalary: 0,
    itSkillScore: judgement.itSkillScore,
    businessSkillScore: judgement.businessSkillScore,
    itSkillGradeName: judgement.itSkill.gradeName,
    businessSkillGradeName: judgement.businessSkill.gradeName,
    nextItSkillGradeName: judgement.itSkill.nextGradeName,
    nextBusinessSkillGradeName: judgement.businessSkill.nextGradeName,
    items,
    source: "fallback",
  };
}

export async function getFinalReviewBundle(selectedUserId?: string, evaluationPeriodId?: string): Promise<FinalReviewBundle> {
  if (!hasDatabaseUrl()) {
    return buildFallbackBundle(selectedUserId);
  }

  try {
    const period = await resolveEvaluationPeriod(evaluationPeriodId);
    const [evaluations, itemRows] = await Promise.all([
      prisma.employeeEvaluation.findMany({
        where: { evaluationPeriodId: period.id },
        orderBy: [{ team: { name: "asc" } }, { user: { name: "asc" } }],
        select: {
          id: true,
          userId: true,
          status: true,
          selfComment: true,
          managerComment: true,
          finalComment: true,
          selfScoreTotal: true,
          managerScoreTotal: true,
          finalScoreTotal: true,
          finalRating: true,
          user: {
            select: {
              name: true,
              positionId: true,
              position: { select: { name: true } },
              salaryRecords: {
                orderBy: { effectiveFrom: "desc" },
                take: 1,
                select: { baseSalary: true, allowance: true },
              },
            },
          },
          team: { select: { name: true } },
          itSkillGrade: { select: { gradeName: true, rankOrder: true } },
          businessSkillGrade: { select: { gradeName: true, rankOrder: true } },
          scores: {
            where: { reviewType: { in: [ReviewType.SELF, ReviewType.MANAGER, ReviewType.FINAL] } },
            select: {
              evaluationItemId: true,
              reviewType: true,
              score: true,
              comment: true,
              evidences: {
                select: {
                  id: true,
                  summary: true,
                  targetName: true,
                  periodNote: true,
                },
              },
            },
          },
        },
      }),
      prisma.evaluationItem.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          weight: true,
          axis: true,
          scoreType: true,
          majorCategory: true,
          minorCategory: true,
          evidenceRequired: true,
        },
      }),
    ]);

    const visibilityMap = await getUserMenuVisibilityMap(evaluations.map((evaluation) => evaluation.userId));
    const visibleEvaluations = evaluations.filter((evaluation) => visibilityMap[evaluation.userId]?.philosophyPractice);

    const members = visibleEvaluations.map((evaluation) => {
      const latestOverall = judgeOverallGrade(
        evaluation.itSkillGrade?.rankOrder ? Math.round(evaluation.itSkillGrade.rankOrder / 10) : 0,
        evaluation.businessSkillGrade?.rankOrder ? Math.round(evaluation.businessSkillGrade.rankOrder / 10) : 0,
      );

      return {
        userId: evaluation.userId,
        name: evaluation.user.name,
        teamName: evaluation.team.name,
        positionName: evaluation.user.position?.name ?? "未設定",
        positionId: evaluation.user.positionId,
        status: evaluation.status,
        selfScoreTotal: toNumber(evaluation.selfScoreTotal),
        managerScoreTotal: toNumber(evaluation.managerScoreTotal),
        finalScoreTotal: toNumber(evaluation.finalScoreTotal),
        finalRating: resolveDisplayedFinalRating(evaluation.managerComment, evaluation.finalRating, resolveDisplayStage(evaluation.status), toNumber(evaluation.finalScoreTotal)),
        overallGradeName: latestOverall.gradeName,
        itSkillGradeName: evaluation.itSkillGrade?.gradeName ?? "未判定",
        businessSkillGradeName: evaluation.businessSkillGrade?.gradeName ?? "未判定",
        evaluation,
      };
    });

    const target = members.find((member) => member.userId === selectedUserId) ?? members[0];
    if (!target) {
      return {
        evaluationPeriodId: period.id,
        periodName: period.name,
        periodStatus: period.status,
        members: [],
        selectedUserId: "",
        selectedUserName: "",
        teamName: "",
        positionName: "",
        status: EvaluationStatus.SELF_REVIEW,
        displayStage: "SELF",
        selfComment: "",
        managerComment: "",
        finalComment: "",
        selfScoreTotal: 0,
        managerScoreTotal: 0,
        finalScoreTotal: 0,
        finalRating: "-",
        overallGradeName: "未判定",
        selfGrowthProgress: 0,
        synergyProgress: 0,
        selfGrowthPoint: 0,
        synergyPoint: 0,
        totalGradePoint: 0,
        salarySelfGrowthPoint: 0,
        salarySynergyPoint: 0,
        salaryTotalGradePoint: 0,
        gradeBaseAmount: 0,
        pointUnitAmount: 0,
        gradeSalaryAmount: 0,
        currentSalary: 0,
        itSkillScore: 0,
        businessSkillScore: 0,
        itSkillGradeName: "未判定",
        businessSkillGradeName: "未判定",
        nextItSkillGradeName: "-",
        nextBusinessSkillGradeName: "-",
        items: [],
        source: "database",
      };
    }

    const scoreMap = {
      self: new Map(target.evaluation.scores.filter((row) => row.reviewType === ReviewType.SELF).map((row) => [row.evaluationItemId, row])),
      manager: new Map(target.evaluation.scores.filter((row) => row.reviewType === ReviewType.MANAGER).map((row) => [row.evaluationItemId, row])),
      final: new Map(target.evaluation.scores.filter((row) => row.reviewType === ReviewType.FINAL).map((row) => [row.evaluationItemId, row])),
    };

    const items: FinalReviewItem[] = itemRows.map((item) => {
      const meta = resolveStoredItemMetaFromRow(item);
      return {
        evaluationItemId: item.id,
        title: item.title,
        category: item.category,
        axis: meta.axis,
        scoreType: meta.scoreType,
        majorCategory: meta.majorCategory,
        minorCategory: meta.minorCategory,
        weight: toNumber(item.weight),
        maxScore: meta.scoreType === "LEVEL_2" ? 2 : 1,
        selfScore: normalizeScore(toNumber(scoreMap.self.get(item.id)?.score), meta.scoreType),
        managerScore: normalizeScore(toNumber(scoreMap.manager.get(item.id)?.score), meta.scoreType),
        finalScore: normalizeScore(toNumber(scoreMap.final.get(item.id)?.score), meta.scoreType),
        selfComment: scoreMap.self.get(item.id)?.comment ?? "",
        managerComment: scoreMap.manager.get(item.id)?.comment ?? "",
        finalComment: scoreMap.final.get(item.id)?.comment ?? "",
        evidenceRequired: Boolean(item.evidenceRequired),
        evidences: normalizeEvidences(scoreMap.final.get(item.id)?.evidences),
        inputScope: meta.inputScope,
      };
    });
    const displayStage = resolveDisplayStage(target.status);
    const overallManagerMeta = decodeManagerOverallComment(target.evaluation.managerComment);
    const judgement = await enrichWithGradeJudgement(items, displayStage, target.positionId ?? null);
    const points = calculateAxisPoints(items, displayStage);
    const salaryPoints = calculateSalaryAxisPoints(items, displayStage);
    const gradeSalarySetting = await getGradeSalarySettingBundle();
    const gradeSalaryAmount = gradeSalarySetting.baseAmount + salaryPoints.salaryTotalGradePoint * gradeSalarySetting.pointUnitAmount;
    const finalTotal = calculateTotal(items.map((item) => ({ score: getDisplayScore(item, displayStage), weight: item.weight })));
    const currentSalary = toNumber(target.evaluation.user.salaryRecords[0]?.baseSalary) + toNumber(target.evaluation.user.salaryRecords[0]?.allowance);

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      periodStatus: period.status,
      members: members.map((member) => ({
        userId: member.userId,
        name: member.name,
        teamName: member.teamName,
        status: member.status,
        selfScoreTotal: member.selfScoreTotal,
        managerScoreTotal: member.managerScoreTotal,
        finalScoreTotal: member.finalScoreTotal,
        finalRating: member.finalRating,
        overallGradeName: member.overallGradeName,
        itSkillGradeName: member.itSkillGradeName,
        businessSkillGradeName: member.businessSkillGradeName,
      })),
      selectedUserId: target.userId,
      selectedUserName: target.name,
      teamName: target.teamName,
      positionName: target.positionName,
      status: target.status,
      displayStage,
      selfComment: target.evaluation.selfComment ?? "",
      managerComment: overallManagerMeta.comment,
      finalComment: target.evaluation.finalComment ?? "",
      selfScoreTotal: toNumber(target.evaluation.selfScoreTotal),
      managerScoreTotal: toNumber(target.evaluation.managerScoreTotal),
      finalScoreTotal: finalTotal,
      finalRating: resolveDisplayedFinalRating(target.evaluation.managerComment, target.evaluation.finalRating, displayStage, finalTotal),
      overallGradeName: judgement.overall.gradeName,
      selfGrowthProgress: calculateProgress(items, "SELF_GROWTH", displayStage),
      synergyProgress: calculateProgress(items, "SYNERGY", displayStage),
      selfGrowthPoint: points.selfGrowthPoint,
      synergyPoint: points.synergyPoint,
      totalGradePoint: points.totalGradePoint,
      salarySelfGrowthPoint: salaryPoints.salarySelfGrowthPoint,
      salarySynergyPoint: salaryPoints.salarySynergyPoint,
      salaryTotalGradePoint: salaryPoints.salaryTotalGradePoint,
      gradeBaseAmount: gradeSalarySetting.baseAmount,
      pointUnitAmount: gradeSalarySetting.pointUnitAmount,
      gradeSalaryAmount,
      currentSalary,
      itSkillScore: judgement.itSkillScore,
      businessSkillScore: judgement.businessSkillScore,
      itSkillGradeName: target.evaluation.itSkillGrade?.gradeName ?? judgement.itSkill.gradeName,
      businessSkillGradeName: target.evaluation.businessSkillGrade?.gradeName ?? judgement.businessSkill.gradeName,
      nextItSkillGradeName: judgement.itSkill.nextGradeName,
      nextBusinessSkillGradeName: judgement.businessSkill.nextGradeName,
      items,
      source: "database",
    };
  } catch {
    return buildFallbackBundle(selectedUserId);
  }
}

export async function saveFinalReviewBundle(finalizedBy: string, input: SaveFinalReviewInput): Promise<FinalReviewBundle> {
  try {
    const period = await resolveEvaluationPeriod(input.evaluationPeriodId);
    if (period.status !== EvaluationPeriodStatus.CLOSED) {
      throw new Error("この評価期間は最終評価確定フェーズではありません");
    }

    const [itemRows, user] = await Promise.all([
      prisma.evaluationItem.findMany({
        where: { id: { in: input.items.map((item) => item.evaluationItemId) } },
        select: {
          id: true,
          weight: true,
          category: true,
          title: true,
          description: true,
          axis: true,
          scoreType: true,
          majorCategory: true,
          minorCategory: true,
          evidenceRequired: true,
        },
      }),
      prisma.user.findUnique({ where: { id: input.userId }, select: { positionId: true } }),
    ]);
    const itemMap = new Map(itemRows.map((item) => [item.id, item]));
    const total = calculateTotal(
      input.items.map((item) => {
        const row = itemMap.get(item.evaluationItemId);
        const scoreType = row ? resolveStoredItemMetaFromRow(row).scoreType : "LEVEL_2";
        return {
          score: normalizeScore(item.score, scoreType),
          weight: row ? toNumber(row.weight) : 0,
        };
      }),
    );
    const judgementItems: FinalReviewItem[] = itemRows.map((item) => {
      const meta = resolveStoredItemMetaFromRow(item);
      const saved = input.items.find((candidate) => candidate.evaluationItemId === item.id);
      return {
        evaluationItemId: item.id,
        title: item.title,
        category: item.category,
        axis: meta.axis,
        scoreType: meta.scoreType,
        majorCategory: meta.majorCategory,
        minorCategory: meta.minorCategory,
        weight: toNumber(item.weight),
        maxScore: meta.scoreType === "LEVEL_2" ? 2 : 1,
        selfScore: 0,
        managerScore: 0,
        finalScore: normalizeScore(saved?.score ?? 0, meta.scoreType),
        selfComment: "",
        managerComment: "",
        finalComment: saved?.comment ?? "",
        evidenceRequired: Boolean(item.evidenceRequired),
        evidences: normalizeEvidences(saved?.evidences),
        inputScope: meta.inputScope,
      };
    });
    const judgement = await enrichWithGradeJudgement(judgementItems, "FINAL", user?.positionId ?? null);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.employeeEvaluation.findUnique({
        where: {
          userId_evaluationPeriodId: {
            userId: input.userId,
            evaluationPeriodId: input.evaluationPeriodId,
          },
        },
        select: { id: true, status: true, finalScoreTotal: true, finalRating: true, managerComment: true },
      });

      const finalRating = resolveDisplayedFinalRating(existing?.managerComment, existing?.finalRating, "FINAL", total);

      const evaluation = await tx.employeeEvaluation.update({
        where: {
          userId_evaluationPeriodId: {
            userId: input.userId,
            evaluationPeriodId: input.evaluationPeriodId,
          },
        },
        data: {
          status: EvaluationStatus.FINALIZED,
          finalComment: input.finalComment,
          finalScoreTotal: total,
          finalRating,
          itSkillGradeId: judgement.itSkill.gradeId,
          businessSkillGradeId: judgement.businessSkill.gradeId,
          finalizedBy,
          finalizedAt: new Date(),
        },
        select: { id: true },
      });

      for (const item of input.items) {
        const row = itemMap.get(item.evaluationItemId);
        const scoreType = row ? resolveStoredItemMetaFromRow(row).scoreType : "LEVEL_2";
        const normalizedScore = normalizeScore(item.score, scoreType);

        const normalizedEvidences = normalizeEvidences(item.evidences);

        const savedScore = await tx.evaluationScore.upsert({
          where: {
            employeeEvaluationId_evaluationItemId_reviewType: {
              employeeEvaluationId: evaluation.id,
              evaluationItemId: item.evaluationItemId,
              reviewType: ReviewType.FINAL,
            },
          },
          update: { score: normalizedScore, comment: item.comment || null },
          create: {
            employeeEvaluationId: evaluation.id,
            evaluationItemId: item.evaluationItemId,
            reviewType: ReviewType.FINAL,
            score: normalizedScore,
            comment: item.comment || null,
          },
          select: { id: true },
        });

        await tx.evaluationScoreEvidence.deleteMany({ where: { evaluationScoreId: savedScore.id } });

        if (normalizedEvidences.length > 0) {
          await tx.evaluationScoreEvidence.createMany({
            data: normalizedEvidences.map((evidence) => ({
              evaluationScoreId: savedScore.id,
              summary: evidence.summary,
              targetName: evidence.targetName || null,
              periodNote: evidence.periodNote || null,
            })),
          });
        }
      }

      await writeApprovalLog({
        actedBy: finalizedBy,
        targetType: "employee_evaluation",
        targetId: evaluation.id,
        action: "FINALIZE_EVALUATION",
        comment: input.finalComment,
      });
      await writeAuditLog({
        userId: finalizedBy,
        action: "FINALIZE_EVALUATION",
        resourceType: "employee_evaluation",
        resourceId: evaluation.id,
        beforeJson: existing,
        afterJson: {
          status: EvaluationStatus.FINALIZED,
          finalScoreTotal: total,
          finalRating,
          userId: input.userId,
          evaluationPeriodId: input.evaluationPeriodId,
          itSkillGradeId: judgement.itSkill.gradeId,
          businessSkillGradeId: judgement.businessSkill.gradeId,
          positionId: user?.positionId ?? null,
        },
      });
    });

    return getFinalReviewBundle(input.userId, input.evaluationPeriodId);
  } catch {
    const fallback = await buildFallbackBundle(input.userId);
    const nextItems = fallback.items.map((item) => {
      const saved = input.items.find((candidate) => candidate.evaluationItemId === item.evaluationItemId);
      return saved
        ? { ...item, finalScore: normalizeScore(saved.score, item.scoreType), finalComment: saved.comment, evidences: normalizeEvidences(saved.evidences) }
        : item;
    });
    const displayStage = "FINAL" as const;
    const judgement = await enrichWithGradeJudgement(nextItems, displayStage, null);
    const points = calculateAxisPoints(nextItems, displayStage);
    const gradeSalarySetting = await getGradeSalarySettingBundle();
    const gradeSalaryAmount = gradeSalarySetting.baseAmount + points.totalGradePoint * gradeSalarySetting.pointUnitAmount;
    const finalTotal = calculateTotal(nextItems.map((item) => ({ score: getDisplayScore(item, displayStage), weight: item.weight })));
    return {
      ...fallback,
      evaluationPeriodId: input.evaluationPeriodId,
      periodStatus: EvaluationPeriodStatus.CLOSED,
      selectedUserId: input.userId,
      finalComment: input.finalComment,
      items: nextItems,
      finalScoreTotal: finalTotal,
      finalRating: deriveRatingFromScore(finalTotal),
      overallGradeName: judgement.overall.gradeName,
      selfGrowthProgress: calculateProgress(nextItems, "SELF_GROWTH", displayStage),
      synergyProgress: calculateProgress(nextItems, "SYNERGY", displayStage),
      selfGrowthPoint: points.selfGrowthPoint,
      synergyPoint: points.synergyPoint,
      totalGradePoint: points.totalGradePoint,
      gradeBaseAmount: gradeSalarySetting.baseAmount,
      pointUnitAmount: gradeSalarySetting.pointUnitAmount,
      gradeSalaryAmount,
      currentSalary: 0,
      itSkillScore: judgement.itSkillScore,
      businessSkillScore: judgement.businessSkillScore,
      itSkillGradeName: judgement.itSkill.gradeName,
      businessSkillGradeName: judgement.businessSkill.gradeName,
      nextItSkillGradeName: judgement.itSkill.nextGradeName,
      nextBusinessSkillGradeName: judgement.businessSkill.nextGradeName,
      status: EvaluationStatus.FINALIZED,
      displayStage,
      source: "fallback",
    };
  }
}


