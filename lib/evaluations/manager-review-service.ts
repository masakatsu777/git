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

export type ManagerCategoryReviewStatus = "PENDING" | "REVISION_REQUESTED" | "APPROVED";
export type ManagerExpectedFulfillmentRank = "A" | "B" | "C" | "";

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
  managerReviewStatus: ManagerCategoryReviewStatus;
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
  expectedFulfillmentRank: ManagerExpectedFulfillmentRank;
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

const MANAGER_CATEGORY_META_PREFIX = "__MANAGER_CATEGORY_META__";
const MANAGER_OVERALL_META_PREFIX = "__MANAGER_OVERALL_META__";

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

export function encodeManagerCategoryComment(comment: string, reviewStatus: ManagerCategoryReviewStatus) {
  const trimmed = comment.trim();
  return `${MANAGER_CATEGORY_META_PREFIX}${JSON.stringify({ reviewStatus })}\n${trimmed}`;
}

export function decodeManagerCategoryComment(rawComment?: string | null): { reviewStatus: ManagerCategoryReviewStatus; comment: string } {
  const source = String(rawComment ?? "");
  if (!source.startsWith(MANAGER_CATEGORY_META_PREFIX)) {
    return {
      reviewStatus: "PENDING" as ManagerCategoryReviewStatus,
      comment: source,
    };
  }

  const newLineIndex = source.indexOf("\n");
  const metaPayload = newLineIndex >= 0 ? source.slice(MANAGER_CATEGORY_META_PREFIX.length, newLineIndex) : source.slice(MANAGER_CATEGORY_META_PREFIX.length);

  try {
    const parsed = JSON.parse(metaPayload) as { reviewStatus?: ManagerCategoryReviewStatus };
    return {
      reviewStatus: parsed.reviewStatus === "REVISION_REQUESTED" || parsed.reviewStatus === "APPROVED" ? parsed.reviewStatus : ("PENDING" as ManagerCategoryReviewStatus),
      comment: newLineIndex >= 0 ? source.slice(newLineIndex + 1) : "",
    };
  } catch {
    return {
      reviewStatus: "PENDING" as ManagerCategoryReviewStatus,
      comment: source,
    };
  }
}

export function decodeManagerOverallComment(rawComment?: string | null): { expectedFulfillmentRank: ManagerExpectedFulfillmentRank; comment: string } {
  const source = String(rawComment ?? "");
  if (!source.startsWith(MANAGER_OVERALL_META_PREFIX)) {
    return {
      expectedFulfillmentRank: "",
      comment: source,
    };
  }

  const newLineIndex = source.indexOf("\n");
  const metaPayload = newLineIndex >= 0 ? source.slice(MANAGER_OVERALL_META_PREFIX.length, newLineIndex) : source.slice(MANAGER_OVERALL_META_PREFIX.length);

  try {
    const parsed = JSON.parse(metaPayload) as { expectedFulfillmentRank?: ManagerExpectedFulfillmentRank };
    return {
      expectedFulfillmentRank: parsed.expectedFulfillmentRank === "A" || parsed.expectedFulfillmentRank === "B" || parsed.expectedFulfillmentRank === "C" ? parsed.expectedFulfillmentRank : "",
      comment: newLineIndex >= 0 ? source.slice(newLineIndex + 1) : "",
    };
  } catch {
    return {
      expectedFulfillmentRank: "",
      comment: source,
    };
  }
}

function buildFallbackBundle(selectedUserId?: string): ManagerReviewBundle {
  const members: ManagerReviewMember[] = [
    { userId: "demo-member1", name: "開発 一郎", status: "SELF_REVIEW", selfScoreTotal: 1.1, managerScoreTotal: 0.96 },
    { userId: "demo-member2", name: "開発 二郎", status: "MANAGER_REVIEW", selfScoreTotal: 1.3, managerScoreTotal: 1.18 },
  ];
  const target = members.find((member) => member.userId === selectedUserId) ?? members[0];
  const items: ManagerReviewItem[] = [
    { evaluationItemId: "item-it-foundation", title: "使用技術や業務知識の基礎を理解している", category: "IT_SKILL", axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "ITスキル", majorCategoryOrder: 10, minorCategory: "基礎理解", minorCategoryOrder: 10, weight: 25, maxScore: 2, selfScore: 0, selfComment: "", managerScore: 0, managerComment: "", managerReviewStatus: "PENDING", evidenceRequired: false, evidences: [], inputScope: "BOTH" },
    { evaluationItemId: "item-it-implementation", title: "設計意図を理解して実装へ落とし込める", category: "IT_SKILL", axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "ITスキル", majorCategoryOrder: 10, minorCategory: "実装", minorCategoryOrder: 20, weight: 25, maxScore: 2, selfScore: 0, selfComment: "", managerScore: 0, managerComment: "", managerReviewStatus: "PENDING", evidenceRequired: false, evidences: [], inputScope: "BOTH" },
    { evaluationItemId: "item-synergy-customer", title: "関係深化や追加提案につながる行動を継続して行っている", category: "BUSINESS_SKILL", axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", majorCategory: "顧客拡張力", majorCategoryOrder: 10, minorCategory: "関係深化", minorCategoryOrder: 10, weight: 8, maxScore: 1, selfScore: 0, selfComment: "単発対応はある", managerScore: 0, managerComment: "継続実践までは未到達", managerReviewStatus: "PENDING", evidenceRequired: true, evidences: [], inputScope: "BOTH" },
    { evaluationItemId: "item-synergy-team", title: "レビューや伴走を通じて他者の成長支援を継続して行っている", category: "BUSINESS_SKILL", axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", majorCategory: "育成支援力", majorCategoryOrder: 20, minorCategory: "レビュー支援", minorCategoryOrder: 10, weight: 7, maxScore: 1, selfScore: 1, selfComment: "レビュー支援を継続", managerScore: 1, managerComment: "継続支援できている", managerReviewStatus: "APPROVED", evidenceRequired: true, evidences: [], inputScope: "BOTH" },
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
    expectedFulfillmentRank: "B",
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
        expectedFulfillmentRank: "",
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
    const overallManagerMeta = decodeManagerOverallComment(target.evaluation?.managerComment);

    const items: ManagerReviewItem[] = itemRows.flatMap((item) => {
      const meta = resolveStoredItemMetaFromRow(item);
      if (meta.inputScope === "SELF" || meta.inputScope === "ADMIN") {
        return [];
      }
      const decodedManagerComment = decodeManagerCategoryComment(managerMap.get(item.id)?.comment);
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
        managerComment: decodedManagerComment.comment,
        managerReviewStatus: decodedManagerComment.reviewStatus,
        evidenceRequired: Boolean(item.evidenceRequired),
        evidences: normalizeEvidences(selfMap.get(item.id)?.evidences),
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
      managerComment: overallManagerMeta.comment,
      expectedFulfillmentRank: overallManagerMeta.expectedFulfillmentRank,
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
    const overallManagerMeta = decodeManagerOverallComment(input.managerComment);
    const nextItems = fallback.items.map((item) => {
      const saved = input.items.find((candidate) => candidate.evaluationItemId === item.evaluationItemId);
      if (!saved) {
        return item;
      }
      const decoded = decodeManagerCategoryComment(saved.comment);
      return {
        ...item,
        managerScore: normalizeScore(saved.score, item.scoreType),
        managerComment: decoded.comment,
        managerReviewStatus: decoded.reviewStatus,
        evidences: normalizeEvidences(saved.evidences),
      };
    });
    return {
      ...fallback,
      evaluationPeriodId: input.evaluationPeriodId,
      periodStatus: EvaluationPeriodStatus.OPEN,
      selectedUserId: input.userId,
      managerComment: overallManagerMeta.comment,
      expectedFulfillmentRank: overallManagerMeta.expectedFulfillmentRank,
      items: nextItems,
      managerScoreTotal: calculateTotal(nextItems.map((item) => ({ score: item.managerScore, weight: item.weight }))),
      selfGrowthProgress: calculateProgress(nextItems, "SELF_GROWTH", "managerScore"),
      synergyProgress: calculateProgress(nextItems, "SYNERGY", "managerScore"),
      source: "fallback",
    };
  }
}
