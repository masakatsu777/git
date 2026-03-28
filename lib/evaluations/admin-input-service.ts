import { EvaluationPeriodStatus, EvaluationStatus, ReviewType } from "@/generated/prisma";

import { resolveEvaluationPeriod } from "@/lib/evaluations/period-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { resolveStoredItemMetaFromRow, type EvaluationEvidence, type SelfReviewItem, type SelfReviewScoreType } from "@/lib/evaluations/self-review-service";

export type AdminInputMember = {
  userId: string;
  name: string;
  status: string;
  selfScoreTotal: number;
};

export type AdminInputItem = SelfReviewItem;

export type AdminInputBundle = {
  evaluationPeriodId: string;
  periodName: string;
  periodStatus: EvaluationPeriodStatus;
  teamId: string;
  teamName: string;
  selectedUserId: string | null;
  selectedUserName: string;
  status: string;
  selfComment: string;
  selfScoreTotal: number;
  items: AdminInputItem[];
  members: AdminInputMember[];
  source: "database" | "fallback";
};

export type SaveAdminInput = {
  evaluationPeriodId: string;
  teamId: string;
  userId: string;
  selfComment: string;
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

function normalizeEvidences(
  evidences?: Array<EvaluationEvidence | { id?: string; summary: string; targetName: string | null; periodNote: string | null }>,
) {
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

function sortItems<T extends { majorCategoryOrder: number; minorCategoryOrder: number; displayOrder: number; evaluationItemId: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      left.majorCategoryOrder - right.majorCategoryOrder ||
      left.minorCategoryOrder - right.minorCategoryOrder ||
      left.displayOrder - right.displayOrder ||
      left.evaluationItemId.localeCompare(right.evaluationItemId, "ja"),
  );
}

function fallbackBundle(teamId: string): AdminInputBundle {
  return {
    evaluationPeriodId: "period-2025-h2",
    periodName: "2025年度下期",
    periodStatus: EvaluationPeriodStatus.OPEN,
    teamId,
    teamName: "未設定チーム",
    selectedUserId: null,
    selectedUserName: "",
    status: EvaluationStatus.SELF_REVIEW,
    selfComment: "",
    selfScoreTotal: 0,
    items: [],
    members: [],
    source: "fallback",
  };
}

export async function getAdminInputBundle(teamId: string, selectedUserId?: string, evaluationPeriodId?: string): Promise<AdminInputBundle> {
  if (!hasDatabaseUrl()) {
    return fallbackBundle(teamId);
  }

  try {
    const period = await resolveEvaluationPeriod(evaluationPeriodId);
    const [team, memberships, itemRows] = await Promise.all([
      prisma.team.findUniqueOrThrow({
        where: { id: teamId },
        select: { id: true, name: true },
      }),
      prisma.teamMembership.findMany({
        where: { teamId, endDate: null },
        orderBy: [{ isPrimary: "desc" }, { startDate: "desc" }],
        select: {
          userId: true,
          user: { select: { name: true } },
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
          displayOrder: true,
        },
      }),
    ]);

    const uniqueMembers = memberships.filter((membership, index, rows) => rows.findIndex((candidate) => candidate.userId === membership.userId) === index);
    const memberIds = uniqueMembers.map((membership) => membership.userId);

    const evaluations = memberIds.length > 0
      ? await prisma.employeeEvaluation.findMany({
          where: {
            teamId,
            evaluationPeriodId: period.id,
            userId: { in: memberIds },
          },
          select: {
            id: true,
            userId: true,
            status: true,
            selfComment: true,
            selfScoreTotal: true,
            scores: {
              where: { reviewType: ReviewType.SELF },
              select: {
                evaluationItemId: true,
                score: true,
                comment: true,
                evidences: {
                  select: {
                    id: true,
                    summary: true,
                    targetName: true,
                    periodNote: true,
                  },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        })
      : [];

    const evaluationMap = new Map(evaluations.map((evaluation) => [evaluation.userId, evaluation]));
    const members: AdminInputMember[] = uniqueMembers.map((membership) => {
      const evaluation = evaluationMap.get(membership.userId);
      return {
        userId: membership.userId,
        name: membership.user.name,
        status: evaluation?.status ?? EvaluationStatus.SELF_REVIEW,
        selfScoreTotal: toNumber(evaluation?.selfScoreTotal),
      };
    });

    const effectiveUserId = selectedUserId ?? members[0]?.userId ?? null;
    const selectedEvaluation = effectiveUserId ? evaluationMap.get(effectiveUserId) : null;
    const scoreMap = new Map((selectedEvaluation?.scores ?? []).map((score) => [score.evaluationItemId, score]));

    const items = sortItems(itemRows.flatMap((item) => {
      const meta = resolveStoredItemMetaFromRow(item);
      if (meta.inputScope !== "ADMIN") {
        return [];
      }
      const saved = scoreMap.get(item.id);
      const scoreType = meta.scoreType;
      return [{
        evaluationItemId: item.id,
        title: item.title,
        category: item.category,
        axis: meta.axis,
        scoreType,
        majorCategory: meta.majorCategory,
        majorCategoryOrder: meta.majorCategoryOrder,
        minorCategory: meta.minorCategory,
        minorCategoryOrder: meta.minorCategoryOrder,
        weight: toNumber(item.weight),
        displayOrder: item.displayOrder ?? 0,
        maxScore: scoreType === "LEVEL_2" ? 2 : 1,
        score: normalizeScore(toNumber(saved?.score), scoreType),
        comment: saved?.comment ?? "",
        evidenceRequired: Boolean(item.evidenceRequired),
        evidences: normalizeEvidences(saved?.evidences),
        inputScope: meta.inputScope,
      }];
    }));

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      periodStatus: period.status,
      teamId: team.id,
      teamName: team.name,
      selectedUserId: effectiveUserId,
      selectedUserName: members.find((member) => member.userId === effectiveUserId)?.name ?? "",
      status: selectedEvaluation?.status ?? EvaluationStatus.SELF_REVIEW,
      selfComment: selectedEvaluation?.selfComment ?? "",
      selfScoreTotal: effectiveUserId ? calculateTotal(items) : 0,
      items,
      members,
      source: "database",
    };
  } catch {
    return fallbackBundle(teamId);
  }
}

export async function saveAdminInputBundle(input: SaveAdminInput): Promise<AdminInputBundle> {
  if (!hasDatabaseUrl()) {
    const fallback = fallbackBundle(input.teamId);
    return {
      ...fallback,
      evaluationPeriodId: input.evaluationPeriodId,
      teamId: input.teamId,
      selectedUserId: input.userId,
      selfComment: input.selfComment,
      source: "fallback",
    };
  }

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

  await prisma.$transaction(async (tx) => {
    await tx.employeeEvaluation.upsert({
      where: {
        userId_evaluationPeriodId: {
          userId: input.userId,
          evaluationPeriodId: input.evaluationPeriodId,
        },
      },
      update: {
        teamId: input.teamId,
        selfComment: input.selfComment,
      },
      create: {
        userId: input.userId,
        evaluationPeriodId: input.evaluationPeriodId,
        teamId: input.teamId,
        status: EvaluationStatus.SELF_REVIEW,
        selfComment: input.selfComment,
      },
    });

    const evaluation = await tx.employeeEvaluation.findUniqueOrThrow({
      where: {
        userId_evaluationPeriodId: {
          userId: input.userId,
          evaluationPeriodId: input.evaluationPeriodId,
        },
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
            reviewType: ReviewType.SELF,
          },
        },
        update: {
          score: normalizedScore,
          comment: item.comment || null,
        },
        create: {
          employeeEvaluationId: evaluation.id,
          evaluationItemId: item.evaluationItemId,
          reviewType: ReviewType.SELF,
          score: normalizedScore,
          comment: item.comment || null,
        },
        select: { id: true },
      });

      await tx.evaluationScoreEvidence.deleteMany({
        where: { evaluationScoreId: savedScore.id },
      });

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

    const allSelfScores = await tx.evaluationScore.findMany({
      where: {
        employeeEvaluationId: evaluation.id,
        reviewType: ReviewType.SELF,
      },
      select: {
        score: true,
        evaluationItem: {
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
          },
        },
      },
    });

    const total = calculateTotal(allSelfScores.map((score) => {
      const scoreType = resolveStoredItemMetaFromRow(score.evaluationItem).scoreType;
      return {
        score: normalizeScore(toNumber(score.score), scoreType),
        weight: toNumber(score.evaluationItem.weight),
      };
    }));

    await tx.employeeEvaluation.update({
      where: { id: evaluation.id },
      data: { selfScoreTotal: total },
    });
  });

  return getAdminInputBundle(input.teamId, input.userId, input.evaluationPeriodId);
}
