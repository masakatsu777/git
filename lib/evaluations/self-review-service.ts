import { EvaluationPeriodStatus, EvaluationStatus, ReviewType } from "@/generated/prisma";

import { resolveEvaluationPeriod } from "@/lib/evaluations/period-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type SelfReviewAxis = "SELF_GROWTH" | "SYNERGY";
export type SelfReviewScoreType = "LEVEL_2" | "CONTINUOUS_DONE";

export type EvaluationEvidence = {
  id?: string;
  summary: string;
  targetName: string;
  periodNote: string;
};

export type SelfReviewItem = {
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
  displayOrder: number;
  maxScore: number;
  score: number;
  comment: string;
  evidenceRequired: boolean;
  evidences: EvaluationEvidence[];
  inputScope: "SELF" | "MANAGER" | "ADMIN" | "BOTH";
};

export type SelfReviewBundle = {
  evaluationPeriodId: string;
  periodName: string;
  periodStatus: EvaluationPeriodStatus;
  status: string;
  selfComment: string;
  selfScoreTotal: number;
  selfGrowthProgress: number;
  synergyProgress: number;
  items: SelfReviewItem[];
  source: "database" | "fallback";
};

export type SaveSelfReviewInput = {
  evaluationPeriodId: string;
  selfComment: string;
  items: Array<{
    evaluationItemId: string;
    score: number;
    comment: string;
    evidences?: EvaluationEvidence[];
  }>;
};

type ItemMeta = {
  axis: SelfReviewAxis;
  scoreType: SelfReviewScoreType;
  inputScope: "SELF" | "MANAGER" | "ADMIN" | "BOTH";
  majorCategory: string;
  majorCategoryOrder: number;
  minorCategory: string;
  minorCategoryOrder: number;
};

type StoredItemMetaInput =
  | string
  | null
  | undefined
  | {
      axis?: SelfReviewAxis | null;
      scoreType?: SelfReviewScoreType | null;
      majorCategory?: string | null;
      majorCategoryOrder?: number | null;
      minorCategory?: string | null;
      minorCategoryOrder?: number | null;
      inputScope?: "SELF" | "MANAGER" | "ADMIN" | "BOTH" | null;
      description?: string | null;
      displayOrder?: number | null;
    };

const META_PREFIX = "__EVAL_META__";

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

function inferItemMeta(title: string, category: "IT_SKILL" | "BUSINESS_SKILL"): ItemMeta {
  if (category === "IT_SKILL") {
    if (title.includes("設計")) {
      return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", inputScope: "BOTH", majorCategory: "ITスキル", majorCategoryOrder: 10, minorCategory: "設計", minorCategoryOrder: 20 };
    }
    if (title.includes("実装")) {
      return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", inputScope: "BOTH", majorCategory: "ITスキル", majorCategoryOrder: 10, minorCategory: "実装", minorCategoryOrder: 30 };
    }
    if (title.includes("課題")) {
      return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", inputScope: "BOTH", majorCategory: "課題解決力", majorCategoryOrder: 20, minorCategory: title, minorCategoryOrder: 10 };
    }
    if (title.includes("伝") || title.includes("対話") || title.includes("連絡") || title.includes("相談")) {
      return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", inputScope: "BOTH", majorCategory: "対話力", majorCategoryOrder: 30, minorCategory: title, minorCategoryOrder: 10 };
    }
    return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", inputScope: "BOTH", majorCategory: "自律成長力", majorCategoryOrder: 90, minorCategory: title, minorCategoryOrder: 10 };
  }

  if (title.includes("顧客") || title.includes("提案")) {
    return { axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", inputScope: "BOTH", majorCategory: "顧客拡張力", majorCategoryOrder: 10, minorCategory: title, minorCategoryOrder: 10 };
  }
  if (title.includes("チーム") || title.includes("レビュー") || title.includes("伴走")) {
    return { axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", inputScope: "BOTH", majorCategory: "育成支援力", majorCategoryOrder: 20, minorCategory: title, minorCategoryOrder: 10 };
  }
  if (title.includes("共有") || title.includes("ナレッジ")) {
    return { axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", inputScope: "BOTH", majorCategory: "ナレッジ共有力", majorCategoryOrder: 30, minorCategory: title, minorCategoryOrder: 10 };
  }
  return { axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", inputScope: "BOTH", majorCategory: "協調相乗力", majorCategoryOrder: 90, minorCategory: title, minorCategoryOrder: 10 };
}

export function resolveStoredItemMeta(
  title: string,
  category: "IT_SKILL" | "BUSINESS_SKILL",
  storedMeta?: StoredItemMetaInput,
): ItemMeta {
  const fallback = inferItemMeta(title, category);
  const metaObject =
    storedMeta && typeof storedMeta === "object"
      ? storedMeta
      : { description: storedMeta ?? null };
  const displayOrder = Number(metaObject.displayOrder ?? 0) || 0;

  let descriptionMeta: Partial<ItemMeta> = {};
  const description = metaObject.description;
  if (description && description.startsWith(META_PREFIX)) {
    const newLineIndex = description.indexOf("\n");
    const metaPayload = newLineIndex >= 0 ? description.slice(META_PREFIX.length, newLineIndex) : description.slice(META_PREFIX.length);

    try {
      descriptionMeta = JSON.parse(metaPayload) as Partial<ItemMeta>;
    } catch {
      descriptionMeta = {};
    }
  }

  return {
    axis: metaObject.axis === "SYNERGY" ? "SYNERGY" : descriptionMeta.axis === "SYNERGY" ? "SYNERGY" : fallback.axis,
    scoreType:
      metaObject.scoreType === "CONTINUOUS_DONE"
        ? "CONTINUOUS_DONE"
        : descriptionMeta.scoreType === "CONTINUOUS_DONE"
          ? "CONTINUOUS_DONE"
          : fallback.scoreType,
    inputScope:
      metaObject.inputScope === "SELF" || metaObject.inputScope === "MANAGER" || metaObject.inputScope === "ADMIN" || metaObject.inputScope === "BOTH"
        ? metaObject.inputScope
        : descriptionMeta.inputScope === "SELF" || descriptionMeta.inputScope === "MANAGER" || descriptionMeta.inputScope === "ADMIN" || descriptionMeta.inputScope === "BOTH"
          ? descriptionMeta.inputScope
          : fallback.inputScope,
    majorCategory: String(metaObject.majorCategory || descriptionMeta.majorCategory || fallback.majorCategory),
    majorCategoryOrder: Number(metaObject.majorCategoryOrder ?? descriptionMeta.majorCategoryOrder ?? fallback.majorCategoryOrder ?? displayOrder),
    minorCategory: String(metaObject.minorCategory || descriptionMeta.minorCategory || fallback.minorCategory),
    minorCategoryOrder: Number(metaObject.minorCategoryOrder ?? descriptionMeta.minorCategoryOrder ?? fallback.minorCategoryOrder ?? displayOrder),
  };
}

export function resolveStoredItemMetaFromRow(row: {
  title: string;
  category: "IT_SKILL" | "BUSINESS_SKILL";
  description?: string | null;
  axis?: SelfReviewAxis | null;
  scoreType?: SelfReviewScoreType | null;
  majorCategory?: string | null;
  majorCategoryOrder?: number | null;
  minorCategory?: string | null;
  minorCategoryOrder?: number | null;
  inputScope?: "SELF" | "MANAGER" | "ADMIN" | "BOTH" | null;
  displayOrder?: number | null;
}) {
  return resolveStoredItemMeta(row.title, row.category, {
    description: row.description,
    axis: row.axis,
    scoreType: row.scoreType,
    majorCategory: row.majorCategory,
    majorCategoryOrder: row.majorCategoryOrder,
    minorCategory: row.minorCategory,
    minorCategoryOrder: row.minorCategoryOrder,
    inputScope: row.inputScope,
    displayOrder: row.displayOrder,
  });
}

function normalizeScore(rawScore: number, scoreType: SelfReviewScoreType) {
  if (scoreType === "LEVEL_2") {
    return normalizeLevel2Score(rawScore);
  }

  return normalizeContinuousDoneScore(rawScore);
}

function calculateTotal(items: Array<{ score: number; weight: number }>) {
  return round2(items.reduce((sum, item) => sum + item.score * item.weight, 0));
}

function calculateProgress(items: SelfReviewItem[], axis: SelfReviewAxis) {
  const targetItems = items.filter((item) => item.axis === axis && item.inputScope !== "MANAGER" && item.inputScope !== "ADMIN");
  if (targetItems.length === 0) return 0;

  const achieved = targetItems.reduce((sum, item) => sum + item.score * item.weight, 0);
  const possible = targetItems.reduce((sum, item) => sum + item.maxScore * item.weight, 0);
  if (possible === 0) return 0;

  return round2((achieved / possible) * 100);
}

function fallbackBundle(role: string): SelfReviewBundle {
  const items: SelfReviewItem[] = [
    {
      evaluationItemId: "item-it-foundation",
      title: "使用技術や業務知識の基礎を理解している",
      category: "IT_SKILL",
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル",
      majorCategoryOrder: 10,
      minorCategory: "基礎理解",
      minorCategoryOrder: 10,
      weight: 25,
      displayOrder: 1,
      maxScore: 2,
      score: 0,
      comment: "",
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
      majorCategoryOrder: 10,
      minorCategory: "実装",
      minorCategoryOrder: 30,
      weight: 25,
      displayOrder: 2,
      maxScore: 2,
      score: 0,
      comment: "",
      evidenceRequired: false,
      evidences: [],
      inputScope: "BOTH",
    },
    {
      evaluationItemId: "item-problem-solving",
      title: "課題の原因を整理して捉えられる",
      category: "IT_SKILL",
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "課題解決力",
      majorCategoryOrder: 20,
      minorCategory: "課題整理",
      minorCategoryOrder: 10,
      weight: 20,
      displayOrder: 3,
      maxScore: 2,
      score: 0,
      comment: "",
      evidenceRequired: false,
      evidences: [],
      inputScope: "BOTH",
    },
    {
      evaluationItemId: "item-communication",
      title: "必要な情報を整理して伝えられる",
      category: "IT_SKILL",
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "対話力",
      majorCategoryOrder: 30,
      minorCategory: "情報整理",
      minorCategoryOrder: 10,
      weight: 15,
      displayOrder: 4,
      maxScore: 2,
      score: 0,
      comment: "",
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
      majorCategoryOrder: 10,
      minorCategory: "関係深化",
      minorCategoryOrder: 10,
      weight: 8,
      displayOrder: 1,
      maxScore: 1,
      score: role === "leader" ? 1 : 0,
      comment: role === "leader" ? "顧客との定例対話で継続的に改善提案を実施した。" : "単発対応はあるが、継続実践には至っていない。",
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
      majorCategoryOrder: 20,
      minorCategory: "レビュー支援",
      minorCategoryOrder: 10,
      weight: 7,
      displayOrder: 2,
      maxScore: 1,
      score: role === "leader" ? 1 : 0,
      comment: role === "leader" ? "半期を通じてレビューとフォローを継続した。" : "相談対応はあるが、継続的な支援まではできていない。",
      evidenceRequired: true,
      evidences: [],
      inputScope: "BOTH",
    },
  ];

  return {
    evaluationPeriodId: "period-2025-h2",
    periodName: "2025年度下期",
    periodStatus: EvaluationPeriodStatus.OPEN,
    status: "SELF_REVIEW",
    selfComment: role === "leader" ? "自律成長と周囲支援の両面を振り返る。" : "自律成長を中心に、継続実践へつなげる行動を整理する。",
    selfScoreTotal: calculateTotal(items),
    selfGrowthProgress: calculateProgress(items, "SELF_GROWTH"),
    synergyProgress: calculateProgress(items, "SYNERGY"),
    items,
    source: "fallback",
  };
}

async function getPreviousClearedSelfGrowthCategories(userId: string, evaluationPeriodId: string) {
  const periods = await prisma.evaluationPeriod.findMany({
    orderBy: [{ startDate: "desc" }],
    select: { id: true },
  });
  const currentIndex = periods.findIndex((period) => period.id === evaluationPeriodId);
  if (currentIndex < 0 || currentIndex >= periods.length - 1) {
    return new Set<string>();
  }

  const previousPeriodId = periods[currentIndex + 1]?.id;
  if (!previousPeriodId) {
    return new Set<string>();
  }

  const previousEvaluation = await prisma.employeeEvaluation.findUnique({
    where: {
      userId_evaluationPeriodId: {
        userId,
        evaluationPeriodId: previousPeriodId,
      },
    },
    select: {
      scores: {
        where: { reviewType: ReviewType.MANAGER },
        select: {
          score: true,
          evaluationItem: {
            select: {
              title: true,
              description: true,
              category: true,
              axis: true,
              scoreType: true,
              majorCategory: true,
              minorCategory: true,
            },
          },
        },
      },
    },
  });

  const categoryStates = new Map<string, boolean>();
  for (const row of previousEvaluation?.scores ?? []) {
    const meta = resolveStoredItemMetaFromRow(row.evaluationItem);
    if (meta.axis !== "SELF_GROWTH" || meta.inputScope === "SELF" || meta.inputScope === "ADMIN") {
      continue;
    }

    const isCleared = normalizeScore(toNumber(row.score), meta.scoreType) >= 2;
    const previous = categoryStates.get(meta.majorCategory);
    categoryStates.set(meta.majorCategory, previous === undefined ? isCleared : previous && isCleared);
  }

  return new Set(Array.from(categoryStates.entries()).filter(([, cleared]) => cleared).map(([majorCategory]) => majorCategory));
}

export async function getSelfReviewBundle(userId: string, role: string, evaluationPeriodId?: string): Promise<SelfReviewBundle> {
  if (!hasDatabaseUrl()) {
    return fallbackBundle(role);
  }

  try {
    const period = await resolveEvaluationPeriod(evaluationPeriodId);

    const [evaluation, itemRows, clearedSelfGrowthCategories] = await Promise.all([
      prisma.employeeEvaluation.findUnique({
        where: {
          userId_evaluationPeriodId: {
            userId,
            evaluationPeriodId: period.id,
          },
        },
        select: {
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
      getPreviousClearedSelfGrowthCategories(userId, period.id),
    ]);

    const scoreMap = new Map(evaluation?.scores.map((row) => [row.evaluationItemId, row]));
    const items: SelfReviewItem[] = itemRows.flatMap((item) => {
      const meta = resolveStoredItemMetaFromRow(item);
      if (meta.inputScope === "MANAGER" || meta.inputScope === "ADMIN") {
        return [];
      }
      const scoreType = meta.scoreType;
      const savedScore = scoreMap.get(item.id);
      const rawScore = savedScore
        ? toNumber(savedScore.score)
        : meta.axis === "SELF_GROWTH" && clearedSelfGrowthCategories.has(meta.majorCategory)
          ? 2
          : 0;
      const normalizedScore = normalizeScore(rawScore, scoreType);

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
        score: normalizedScore,
        comment: savedScore?.comment ?? "",
        evidenceRequired: Boolean(item.evidenceRequired),
        evidences: normalizeEvidences(savedScore?.evidences),
        inputScope: meta.inputScope,
      }];
    });

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      periodStatus: period.status,
      status: evaluation?.status ?? EvaluationStatus.SELF_REVIEW,
      selfComment: evaluation?.selfComment ?? "",
      selfScoreTotal: items.length > 0 ? calculateTotal(items) : toNumber(evaluation?.selfScoreTotal),
      selfGrowthProgress: calculateProgress(items, "SELF_GROWTH"),
      synergyProgress: calculateProgress(items, "SYNERGY"),
      items,
      source: "database",
    };
  } catch {
    return fallbackBundle(role);
  }
}

export async function saveSelfReviewBundle(userId: string, role: string, teamId: string | null, input: SaveSelfReviewInput): Promise<SelfReviewBundle> {
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
        return {
          score: normalizeScore(item.score, scoreType),
          weight: row ? toNumber(row.weight) : 0,
        };
      }),
    );

    const resolvedTeamId =
      teamId ??
      (await prisma.teamMembership.findFirst({
        where: { userId, isPrimary: true, endDate: null },
        orderBy: { startDate: "desc" },
        select: { teamId: true },
      }))?.teamId ??
      (await prisma.employeeEvaluation.findUnique({
        where: {
          userId_evaluationPeriodId: {
            userId,
            evaluationPeriodId: input.evaluationPeriodId,
          },
        },
        select: { teamId: true },
      }))?.teamId ??
      null;

    if (!resolvedTeamId) {
      throw new Error("所属チームが見つからないため自己評価を保存できません。ユーザー管理で所属を確認してください。");
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeEvaluation.upsert({
        where: {
          userId_evaluationPeriodId: {
            userId,
            evaluationPeriodId: input.evaluationPeriodId,
          },
        },
        update: {
          teamId: resolvedTeamId,
          status: EvaluationStatus.SELF_REVIEW,
          selfComment: input.selfComment,
          selfScoreTotal: total,
        },
        create: {
          userId,
          evaluationPeriodId: input.evaluationPeriodId,
          teamId: resolvedTeamId,
          status: EvaluationStatus.SELF_REVIEW,
          selfComment: input.selfComment,
          selfScoreTotal: total,
        },
      });

      const evaluation = await tx.employeeEvaluation.findUniqueOrThrow({
        where: {
          userId_evaluationPeriodId: {
            userId,
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
    });

    return getSelfReviewBundle(userId, role, input.evaluationPeriodId);
  } catch (error) {
    if (!hasDatabaseUrl()) {
      const fallback = fallbackBundle(role);
      const nextItems = fallback.items.map((item) => {
        const saved = input.items.find((candidate) => candidate.evaluationItemId === item.evaluationItemId);
        return saved ? { ...item, score: normalizeScore(saved.score, item.scoreType), comment: saved.comment, evidences: normalizeEvidences(saved.evidences) } : item;
      });

      return {
        ...fallback,
        evaluationPeriodId: input.evaluationPeriodId,
        periodStatus: EvaluationPeriodStatus.OPEN,
        selfComment: input.selfComment,
        items: nextItems,
        selfScoreTotal: calculateTotal(nextItems),
        selfGrowthProgress: calculateProgress(nextItems, "SELF_GROWTH"),
        synergyProgress: calculateProgress(nextItems, "SYNERGY"),
        source: "fallback",
      };
    }

    throw error;
  }
}






