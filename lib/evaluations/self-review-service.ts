import { EvaluationStatus, ReviewType } from "@/generated/prisma";

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
};

export type SelfReviewBundle = {
  evaluationPeriodId: string;
  periodName: string;
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
      return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "ITスキル", majorCategoryOrder: 10, minorCategory: "設計", minorCategoryOrder: 20 };
    }
    if (title.includes("実装")) {
      return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "ITスキル", majorCategoryOrder: 10, minorCategory: "実装", minorCategoryOrder: 30 };
    }
    if (title.includes("課題")) {
      return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "課題解決力", majorCategoryOrder: 20, minorCategory: title, minorCategoryOrder: 10 };
    }
    if (title.includes("伝") || title.includes("対話") || title.includes("連絡") || title.includes("相談")) {
      return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "対話力", majorCategoryOrder: 30, minorCategory: title, minorCategoryOrder: 10 };
    }
    return { axis: "SELF_GROWTH", scoreType: "LEVEL_2", majorCategory: "自律成長力", majorCategoryOrder: 90, minorCategory: title, minorCategoryOrder: 10 };
  }

  if (title.includes("顧客") || title.includes("提案")) {
    return { axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", majorCategory: "顧客拡張力", majorCategoryOrder: 10, minorCategory: title, minorCategoryOrder: 10 };
  }
  if (title.includes("チーム") || title.includes("レビュー") || title.includes("伴走")) {
    return { axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", majorCategory: "育成支援力", majorCategoryOrder: 20, minorCategory: title, minorCategoryOrder: 10 };
  }
  if (title.includes("共有") || title.includes("ナレッジ")) {
    return { axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", majorCategory: "ナレッジ共有力", majorCategoryOrder: 30, minorCategory: title, minorCategoryOrder: 10 };
  }
  return { axis: "SYNERGY", scoreType: "CONTINUOUS_DONE", majorCategory: "協調相乗力", majorCategoryOrder: 90, minorCategory: title, minorCategoryOrder: 10 };
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

  if (metaObject.axis || metaObject.scoreType || metaObject.majorCategory || metaObject.minorCategory) {
    const displayOrder = Number(metaObject.displayOrder ?? 0) || 0;
    return {
      axis: metaObject.axis === "SYNERGY" ? "SYNERGY" : fallback.axis,
      scoreType: metaObject.scoreType === "CONTINUOUS_DONE" ? "CONTINUOUS_DONE" : fallback.scoreType,
      majorCategory: String(metaObject.majorCategory || fallback.majorCategory),
      majorCategoryOrder: Number(metaObject.majorCategoryOrder ?? fallback.majorCategoryOrder ?? displayOrder),
      minorCategory: String(metaObject.minorCategory || fallback.minorCategory),
      minorCategoryOrder: Number(metaObject.minorCategoryOrder ?? fallback.minorCategoryOrder ?? displayOrder),
    };
  }

  const description = metaObject.description;
  if (!description || !description.startsWith(META_PREFIX)) {
    return fallback;
  }

  const newLineIndex = description.indexOf("\n");
  const metaPayload = newLineIndex >= 0 ? description.slice(META_PREFIX.length, newLineIndex) : description.slice(META_PREFIX.length);

  try {
    const parsed = JSON.parse(metaPayload) as Partial<ItemMeta>;
    return {
      axis: parsed.axis === "SYNERGY" ? "SYNERGY" : fallback.axis,
      scoreType: parsed.scoreType === "CONTINUOUS_DONE" ? "CONTINUOUS_DONE" : fallback.scoreType,
      majorCategory: parsed.majorCategory || fallback.majorCategory,
      majorCategoryOrder: Number(parsed.majorCategoryOrder ?? fallback.majorCategoryOrder),
      minorCategory: parsed.minorCategory || fallback.minorCategory,
      minorCategoryOrder: Number(parsed.minorCategoryOrder ?? fallback.minorCategoryOrder),
    };
  } catch {
    return fallback;
  }
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
  return round2(items.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0));
}

function calculateProgress(items: SelfReviewItem[], axis: SelfReviewAxis) {
  const targetItems = items.filter((item) => item.axis === axis);
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
    },
  ];

  return {
    evaluationPeriodId: "period-2025-h2",
    periodName: "2025年度下期",
    status: "SELF_REVIEW",
    selfComment: role === "leader" ? "自律成長と周囲支援の両面を振り返る。" : "自律成長を中心に、継続実践へつなげる行動を整理する。",
    selfScoreTotal: calculateTotal(items),
    selfGrowthProgress: calculateProgress(items, "SELF_GROWTH"),
    synergyProgress: calculateProgress(items, "SYNERGY"),
    items,
    source: "fallback",
  };
}

export async function getSelfReviewBundle(userId: string, role: string, evaluationPeriodId?: string): Promise<SelfReviewBundle> {
  if (!hasDatabaseUrl()) {
    return fallbackBundle(role);
  }

  try {
    const period = await resolveEvaluationPeriod(evaluationPeriodId);

    const [evaluation, itemRows] = await Promise.all([
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
    ]);

    const scoreMap = new Map(evaluation?.scores.map((row) => [row.evaluationItemId, row]));
    const items: SelfReviewItem[] = itemRows.map((item) => {
      const meta = resolveStoredItemMetaFromRow(item);
      const scoreType = meta.scoreType;
      const rawScore = toNumber(scoreMap.get(item.id)?.score);
      const normalizedScore = normalizeScore(rawScore, scoreType);

      return {
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
        comment: scoreMap.get(item.id)?.comment ?? "",
        evidenceRequired: Boolean(item.evidenceRequired),
        evidences: normalizeEvidences(scoreMap.get(item.id)?.evidences),
      };
    });

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
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
    const itemRows = await prisma.evaluationItem.findMany({
      where: { id: { in: input.items.map((item) => item.evaluationItemId) } },
      select: { id: true, title: true, description: true, category: true, weight: true, axis: true, scoreType: true, majorCategory: true, minorCategory: true, evidenceRequired: true },
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
        where: { userId, isPrimary: true },
        orderBy: { startDate: "desc" },
        select: { teamId: true },
      }))?.teamId ??
      "team-platform";

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
  } catch {
    const fallback = fallbackBundle(role);
    const nextItems = fallback.items.map((item) => {
      const saved = input.items.find((candidate) => candidate.evaluationItemId === item.evaluationItemId);
      return saved ? { ...item, score: normalizeScore(saved.score, item.scoreType), comment: saved.comment, evidences: normalizeEvidences(saved.evidences) } : item;
    });

    return {
      ...fallback,
      evaluationPeriodId: input.evaluationPeriodId,
      selfComment: input.selfComment,
      items: nextItems,
      selfScoreTotal: calculateTotal(nextItems),
      selfGrowthProgress: calculateProgress(nextItems, "SELF_GROWTH"),
      synergyProgress: calculateProgress(nextItems, "SYNERGY"),
      source: "fallback",
    };
  }
}






