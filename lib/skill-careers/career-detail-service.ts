import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { judgeOverallGrade } from "@/lib/skill-careers/overall-grade-service";

export type CareerHistoryEvidenceDetailRow = {
  summary: string;
  targetName: string;
  periodNote: string;
};

export type CareerHistoryEvidenceRow = {
  itemTitle: string;
  majorCategory: string;
  weight: number;
  evidences: CareerHistoryEvidenceDetailRow[];
};

export type CareerHistoryRow = {
  evaluationPeriodId: string;
  periodName: string;
  finalRating: string;
  finalScoreTotal: number;
  overallGradeName: string;
  itSkillGradeName: string;
  businessSkillGradeName: string;
  synergyEvidenceCount: number;
  synergyEvidenceItems: CareerHistoryEvidenceRow[];
};

export type CareerDetailBundle = {
  userId: string;
  employeeName: string;
  teamName: string;
  latestItSkillGradeName: string;
  latestBusinessSkillGradeName: string;
  latestOverallGradeName: string;
  latestFinalRating: string;
  latestFinalScoreTotal: number;
  history: CareerHistoryRow[];
  source: "database" | "fallback";
};

const fallbackBundle: CareerDetailBundle = {
  userId: "demo-member1",
  employeeName: "開発 一郎",
  teamName: "プラットフォームチーム",
  latestItSkillGradeName: "IT中級",
  latestBusinessSkillGradeName: "ビジネス中級",
  latestOverallGradeName: "総合G3",
  latestFinalRating: "A",
  latestFinalScoreTotal: 4.05,
  history: [
    {
      evaluationPeriodId: "period-2025-h2",
      periodName: "2025年度下期",
      finalRating: "A",
      finalScoreTotal: 4.05,
      overallGradeName: "総合G3",
      itSkillGradeName: "IT中級",
      businessSkillGradeName: "ビジネス中級",
      synergyEvidenceCount: 2,
      synergyEvidenceItems: [
        {
          itemTitle: "レビューや伴走を通じて他者の成長支援を継続して行っている",
          majorCategory: "育成支援力",
          weight: 2,
          evidences: [
            {
              summary: "後輩2名へ週次レビューを継続",
              targetName: "新卒メンバー",
              periodNote: "毎週コードレビューと課題整理を実施",
            },
          ],
        },
        {
          itemTitle: "自身の知見を周囲へ継続して共有している",
          majorCategory: "ナレッジ共有力",
          weight: 1,
          evidences: [
            {
              summary: "障害対応の知見をチーム共有",
              targetName: "プラットフォームチーム",
              periodNote: "月次ふりかえりで2回共有",
            },
          ],
        },
      ],
    },
    {
      evaluationPeriodId: "period-2025-h1",
      periodName: "2025年度上期",
      finalRating: "B",
      finalScoreTotal: 3.62,
      overallGradeName: "総合G2",
      itSkillGradeName: "IT初級",
      businessSkillGradeName: "ビジネス初級",
      synergyEvidenceCount: 1,
      synergyEvidenceItems: [
        {
          itemTitle: "提案に必要な整理や支援を継続して行っている",
          majorCategory: "提案支援力",
          weight: 2,
          evidences: [
            {
              summary: "提案資料の技術観点整理を支援",
              targetName: "営業チーム",
              periodNote: "上期中に複数案件で継続対応",
            },
          ],
        },
      ],
    },
  ],
  source: "fallback",
};

export async function getCareerDetailBundle(userId: string): Promise<CareerDetailBundle> {
  if (!hasDatabaseUrl()) {
    return { ...fallbackBundle, userId };
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        teamMemberships: {
          where: { isPrimary: true },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { team: { select: { name: true } } },
        },
        employeeEvaluations: {
          where: { status: "FINALIZED" },
          orderBy: { evaluationPeriod: { startDate: "desc" } },
          select: {
            evaluationPeriodId: true,
            finalRating: true,
            finalScoreTotal: true,
            evaluationPeriod: { select: { name: true } },
            itSkillGrade: { select: { gradeName: true, rankOrder: true } },
            businessSkillGrade: { select: { gradeName: true, rankOrder: true } },
            scores: {
              where: {
                reviewType: "FINAL",
                score: { gt: 0 },
                evaluationItem: {
                  axis: "SYNERGY",
                },
              },
              orderBy: [
                { evaluationItem: { majorCategory: "asc" } },
                { evaluationItem: { displayOrder: "asc" } },
              ],
              select: {
                evaluationItem: {
                  select: {
                    title: true,
                    majorCategory: true,
                    weight: true,
                  },
                },
                evidences: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    summary: true,
                    targetName: true,
                    periodNote: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const history = user.employeeEvaluations.map((evaluation) => {
      const overall = judgeOverallGrade(
        evaluation.itSkillGrade?.rankOrder ? Math.round(evaluation.itSkillGrade.rankOrder / 10) : 0,
        evaluation.businessSkillGrade?.rankOrder ? Math.round(evaluation.businessSkillGrade.rankOrder / 10) : 0,
      );
      const synergyEvidenceItems = evaluation.scores.map((scoreRow) => ({
        itemTitle: scoreRow.evaluationItem.title,
        majorCategory: scoreRow.evaluationItem.majorCategory,
        weight: Number(scoreRow.evaluationItem.weight ?? 0),
        evidences: scoreRow.evidences.map((evidence) => ({
          summary: evidence.summary,
          targetName: evidence.targetName ?? "",
          periodNote: evidence.periodNote ?? "",
        })),
      }));

      return {
        evaluationPeriodId: evaluation.evaluationPeriodId,
        periodName: evaluation.evaluationPeriod.name,
        finalRating: evaluation.finalRating ?? "-",
        finalScoreTotal: Number(evaluation.finalScoreTotal ?? 0),
        overallGradeName: overall.gradeName,
        itSkillGradeName: evaluation.itSkillGrade?.gradeName ?? "未判定",
        businessSkillGradeName: evaluation.businessSkillGrade?.gradeName ?? "未判定",
        synergyEvidenceCount: synergyEvidenceItems.reduce((total, item) => total + item.evidences.length, 0),
        synergyEvidenceItems,
      };
    });
    const latest = history[0];

    return {
      userId: user.id,
      employeeName: user.name,
      teamName: user.teamMemberships[0]?.team.name ?? "未所属",
      latestItSkillGradeName: latest?.itSkillGradeName ?? "未判定",
      latestBusinessSkillGradeName: latest?.businessSkillGradeName ?? "未判定",
      latestOverallGradeName: latest?.overallGradeName ?? "未判定",
      latestFinalRating: latest?.finalRating ?? "-",
      latestFinalScoreTotal: latest?.finalScoreTotal ?? 0,
      history,
      source: "database",
    };
  } catch {
    return { ...fallbackBundle, userId };
  }
}
