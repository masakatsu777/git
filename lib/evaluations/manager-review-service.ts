import { EvaluationPeriodStatus, EvaluationStatus, ReviewType } from "@/generated/prisma";

import { resolveEvaluationPeriod } from "@/lib/evaluations/period-service";
import {
  resolveStoredItemMetaFromRow,
  type EvaluationEvidence,
  type SelfReviewAxis,
  type SelfReviewScoreType,
} from "@/lib/evaluations/self-review-service";
import { getUserMenuVisibilityMap } from "@/lib/menu-visibility/menu-visibility-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type ManagerReviewMember = {
  userId: string;
  name: string;
  status: string;
  selfScoreTotal: number;
  managerScoreTotal: number;
};

export type ManagerReviewItem = {
  evaluationItemId: string;
  title: string;
  category: "IT_SKILL" | "BUSINESS_SKILL";
  axis: SelfReviewAxis;
  scoreType: SelfReviewScoreType;
  majorCategory: string;
  majorCategoryOrder: number;
  minorCategory: string;
  minorCategoryOrder: number;
  weight: number;
  maxScore: number;
  selfScore: number;
  selfComment: string;
  managerScore: number;
  managerComment: string;
  evidenceRequired: boolean;
  evidences: EvaluationEvidence[];
  inputScope: "SELF" | "MANAGER" | "ADMIN" | "BOTH";
};

export type ManagerReviewBundle = {
  evaluationPeriodId: string;
  periodName: string;
  periodStatus: EvaluationPeriodStatus;
  teamId: string;
  teamName: string;
  members: ManagerReviewMember[];
  selectedUserId: string;
  selectedUserName: string;
  status: string;
  selfComment: string;
  managerComment: string;
  selfScoreTotal: number;
  managerScoreTotal: number;
  selfGrowthProgress: number;
  synergyProgress: number;
  items: ManagerReviewItem[];
  source: "database" | "fallback";
};

export type SaveManagerReviewInput = {
  evaluationPeriodId: string;
  userId: string;
  managerComment: string;
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
  return round2(items.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0));
}

function calculateProgress(items: ManagerReviewItem[], axis: SelfReviewAxis, scoreField: "selfScore" | "managerScore") {
  const targetItems = items.filter((item) => item.axis === axis && item.inputScope !== "SELF" && item.inputScope !== "ADMIN");
  if (targetItems.length === 0) return 0;
  const achieved = targetItems.reduce((sum, item) => sum + item[scoreField] * item.weight, 0);
  const possible = targetItems.reduce((sum, item) => sum + item.maxScore * item.weight, 0);
  if (possible === 0) return 0;
  return round2((achieved / possible) * 100);
}

function buildFallbackBundle(selectedUserId?: string): ManagerReviewBundle {
  const members: ManagerReviewMember[] = [
    { userId: "demo-member1", name: "開発 一郎", status: "SELF_REVIEW", selfScoreTotal: 1.1, managerScoreTotal: 0.96 },
    { userId: "demo-member2", name: "開発 二郎", status: "MANAGER_REVIEW", selfScoreTotal: 1.3, managerScoreTotal: 1.18 },
  ];
  const target = members.find((member) => member.userId === selectedUserId) ?? members[0];
  const items: ManagerReviewItem[] = [
    { evaluationItemId: "item-it-foundation", title: "使用技術や業務知識の基礎を理解している", category: "IT_SKILL", axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "ITスキル", majorCategoryOrder: 10, minorCategory: "基礎理解", minorCategoryOrder: 10, weight: 25, maxScore: 2, selfScore: 0, selfComment: "", managerScore: 0, managerComment: "", evidenceRequired: false, evidences: [], inputScope: "BOTH" },
    { evaluationItemId: "item-it-implementation", title: "設計意図を理解して実装へ落とし込める", category: "IT_SKILL", axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "ITスキル", majorCategoryOrder: 10, minorCategory: "実装", minorCategoryOrder: 20, weight: 25, maxScore: 2, selfScore: 0, selfComment: "", managerScore: 0, managerComment: "", evidenceRequired: false, evidences: [], inputScope: "BOTH" },
    { evaluationItemId: "item-synergy-customer", title: "関係深化や追加提案につながる行動を継続して行っている", category: "BUSINESS_SKILL", axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", majorCategory: "顧客拡張力", majorCategoryOrder: 10, minorCategory: "関係深化", minorCategoryOrder: 10, weight: 8, maxScore: 1, selfScore: 0, selfComment: "単発対応はある", managerScore: 0, managerComment: "継続実践までは未到達", evidenceRequired: true, evidences: [], inputScope: "BOTH" },
    { evaluationItemId: "item-synergy-team", title: "レビューや伴走を通じて他者の成長支援を継続して行っている", category: "BUSINESS_SKILL", axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", majorCategory: "育成支援力", majorCategoryOrder: 20, minorCategory: "レビュー支援", minorCategoryOrder: 10, weight: 7, maxScore: 1, selfScore: 1, selfComment: "レビュー支援を継続", managerScore: 1, managerComment: "継続支援できている", evidenceRequired: true, evidences: [], inputScope: "BOTH" },
  ];

  return {
    evaluationPeriodId: "period-2025-h2",
    periodName: "2025年度下期",
    periodStatus: EvaluationPeriodStatus.OPEN,
    teamId: "team-platform",
    teamName: "プラットフォームチーム",
    members,
    selectedUserId: target.userId,
    selectedUserName: target.name,
    status: target.status,
    selfComment: "自律成長を中心に振り返る",
    managerComment: "継続実践は一部で確認できるため、次期は広がりを期待します。",
    selfScoreTotal: target.selfScoreTotal,
    managerScoreTotal: calculateTotal(items.map((item) => ({ score: item.managerScore, weight: item.weight }))),
    selfGrowthProgress: calculateProgress(items, "SELF_GROWTH", "managerScore"),
    synergyProgress: calculateProgress(items, "SYNERGY", "managerScore"),
    items,
    source: "fallback",
  };
}

export async function getManagerReviewBundle(teamId: string, selectedUserId?: string, evaluationPeriodId?: string): Promise<ManagerReviewBundle> {
  if (!hasDatabaseUrl()) {
    return buildFallbackBundle(selectedUserId);
  }

  try {
    const period = await resolveEvaluationPeriod(evaluationPeriodId);
    const [team, itemRows] = await Promise.all([
      prisma.team.findUniqueOrThrow({
        where: { id: teamId },
        select: {
          id: true,
          name: true,
          memberships: {
            where: { isPrimary: true, endDate: null },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  employeeEvaluations: {
                    where: { evaluationPeriodId: period.id },
                    select: {
                      id: true,
                      status: true,
                      selfComment: true,
                      managerComment: true,
                      selfScoreTotal: true,
                      managerScoreTotal: true,
                      scores: {
                        where: { reviewType: { in: [ReviewType.SELF, ReviewType.MANAGER] } },
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
                    take: 1,
                  },
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

    const visibilityMap = await getUserMenuVisibilityMap(team.memberships.map((membership) => membership.user.id));
    const visibleMemberships = team.memberships.filter((membership) => visibilityMap[membership.user.id]?.philosophyPractice);

    const members = visibleMemberships.map((membership) => {
      const evaluation = membership.user.employeeEvaluations[0];
      return {
        userId: membership.user.id,
        name: membership.user.name,
        status: evaluation?.status ?? EvaluationStatus.SELF_REVIEW,
        selfScoreTotal: toNumber(evaluation?.selfScoreTotal),
        managerScoreTotal: toNumber(evaluation?.managerScoreTotal),
        evaluation,
      };
    });

    const target = members.find((member) => member.userId === selectedUserId) ?? members[0];
    if (!target) {
      return {
        evaluationPeriodId: period.id,
        periodName: period.name,
        periodStatus: period.status,
        teamId: team.id,
        teamName: team.name,
        members: [],
        selectedUserId: "",
        selectedUserName: "",
        status: EvaluationStatus.SELF_REVIEW,
        selfComment: "",
        managerComment: "",
        selfScoreTotal: 0,
        managerScoreTotal: 0,
        selfGrowthProgress: 0,
        synergyProgress: 0,
        items: [],
        source: "database",
      };
    }

    const selfMap = new Map((target.evaluation?.scores ?? []).filter((row) => row.reviewType === ReviewType.SELF).map((row) => [row.evaluationItemId, row]));
    const managerMap = new Map((target.evaluation?.scores ?? []).filter((row) => row.reviewType === ReviewType.MANAGER).map((row) => [row.evaluationItemId, row]));

    const items: ManagerReviewItem[] = itemRows.flatMap((item) => {
      const meta = resolveStoredItemMetaFromRow(item);
      if (meta.inputScope === "SELF" || meta.inputScope === "ADMIN") {
        return [];
      }
      return [{
        evaluationItemId: item.id,
        title: item.title,
        category: item.category,
        axis: meta.axis,
        scoreType: meta.scoreType,
        majorCategory: meta.majorCategory,
        majorCategoryOrder: meta.majorCategoryOrder,
        minorCategory: meta.minorCategory,
        minorCategoryOrder: meta.minorCategoryOrder,
        weight: toNumber(item.weight),
        maxScore: meta.scoreType === "LEVEL_2" ? 2 : 1,
        selfScore: normalizeScore(toNumber(selfMap.get(item.id)?.score), meta.scoreType),
        selfComment: selfMap.get(item.id)?.comment ?? "",
        managerScore: normalizeScore(toNumber(managerMap.get(item.id)?.score), meta.scoreType),
        managerComment: managerMap.get(item.id)?.comment ?? "",
        evidenceRequired: Boolean(item.evidenceRequired),
        evidences: normalizeEvidences(managerMap.get(item.id)?.evidences),
        inputScope: meta.inputScope,
      }];
    });

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      periodStatus: period.status,
      teamId: team.id,
      teamName: team.name,
      members: members.map((member) => ({
        userId: member.userId,
        name: member.name,
        status: member.status,
        selfScoreTotal: member.selfScoreTotal,
        managerScoreTotal: member.managerScoreTotal,
      })),
      selectedUserId: target.userId,
      selectedUserName: target.name,
      status: target.status,
      selfComment: target.evaluation?.selfComment ?? "",
      managerComment: target.evaluation?.managerComment ?? "",
      selfScoreTotal: toNumber(target.evaluation?.selfScoreTotal),
      managerScoreTotal: calculateTotal(items.map((item) => ({ score: item.managerScore, weight: item.weight }))),
      selfGrowthProgress: calculateProgress(items, "SELF_GROWTH", "managerScore"),
      synergyProgress: calculateProgress(items, "SYNERGY", "managerScore"),
      items,
      source: "database",
    };
  } catch {
    return buildFallbackBundle(selectedUserId);
  }
}

export async function saveManagerReviewBundle(teamId: string, input: SaveManagerReviewInput): Promise<ManagerReviewBundle> {
  try {
    const period = await resolveEvaluationPeriod(input.evaluationPeriodId);
    if (period.status !== EvaluationPeriodStatus.OPEN) {
      throw new Error("この評価期間は閲覧専用です");
    }

    const itemRows = await prisma.evaluationItem.findMany({
      where: { id: { in: input.items.map((item) => item.evaluationItemId) } },
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
    });
    const itemMap = new Map(itemRows.map((item) => [item.id, item]));
    const total = calculateTotal(
      input.items.map((item) => {
        const row = itemMap.get(item.evaluationItemId);
        const scoreType = row ? resolveStoredItemMetaFromRow(row).scoreType : "LEVEL_2";
        return { score: normalizeScore(item.score, scoreType), weight: row ? toNumber(row.weight) : 0 };
      }),
    );

    await prisma.$transaction(async (tx) => {
      const evaluation = await tx.employeeEvaluation.upsert({
        where: {
          userId_evaluationPeriodId: {
            userId: input.userId,
            evaluationPeriodId: input.evaluationPeriodId,
          },
        },
        update: {
          teamId,
          status: EvaluationStatus.MANAGER_REVIEW,
          managerComment: input.managerComment,
          managerScoreTotal: total,
        },
        create: {
          userId: input.userId,
          evaluationPeriodId: input.evaluationPeriodId,
          teamId,
          status: EvaluationStatus.MANAGER_REVIEW,
          managerComment: input.managerComment,
          managerScoreTotal: total,
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
              reviewType: ReviewType.MANAGER,
            },
          },
          update: {
            score: normalizedScore,
            comment: item.comment || null,
          },
          create: {
            employeeEvaluationId: evaluation.id,
            evaluationItemId: item.evaluationItemId,
            reviewType: ReviewType.MANAGER,
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
    });

    return getManagerReviewBundle(teamId, input.userId, input.evaluationPeriodId);
  } catch {
    const fallback = buildFallbackBundle(input.userId);
    const nextItems = fallback.items.map((item) => {
      const saved = input.items.find((candidate) => candidate.evaluationItemId === item.evaluationItemId);
      return saved ? { ...item, managerScore: normalizeScore(saved.score, item.scoreType), managerComment: saved.comment, evidences: normalizeEvidences(saved.evidences) } : item;
    });
    return {
      ...fallback,
      evaluationPeriodId: input.evaluationPeriodId,
      periodStatus: EvaluationPeriodStatus.OPEN,
      selectedUserId: input.userId,
      managerComment: input.managerComment,
      items: nextItems,
      managerScoreTotal: calculateTotal(nextItems.map((item) => ({ score: item.managerScore, weight: item.weight }))),
      selfGrowthProgress: calculateProgress(nextItems, "SELF_GROWTH", "managerScore"),
      synergyProgress: calculateProgress(nextItems, "SYNERGY", "managerScore"),
      source: "fallback",
    };
  }
}
