import { EvaluationPeriodStatus, EvaluationStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type PendingEvaluationMember = {
  name: string;
  href: string;
};

export type EvaluationProgressStat = {
  label: string;
  completed: number;
  total: number;
  href: string;
  pendingMembers: PendingEvaluationMember[];
};

export type EvaluationProgressBundle = {
  evaluationPeriodId: string;
  periodName: string;
  stats: EvaluationProgressStat[];
  source: "database" | "fallback";
};

function buildFallbackBundle(): EvaluationProgressBundle {
  return {
    evaluationPeriodId: "period-2025-h2",
    periodName: "2025年度下期",
    stats: [
      { label: "自己評価完了", completed: 12, total: 18, href: "/evaluations/my", pendingMembers: [{ name: "開発 一郎", href: "/evaluations/my" }, { name: "開発 三郎", href: "/evaluations/my" }] },
      { label: "上長評価完了", completed: 7, total: 18, href: "/evaluations/team", pendingMembers: [{ name: "開発 二郎", href: "/evaluations/team?memberId=demo-member2" }, { name: "開発 四郎", href: "/evaluations/team?memberId=demo-member4" }] },
      { label: "最終評価確定", completed: 2, total: 18, href: "/evaluations/finalize", pendingMembers: [{ name: "主任 次郎", href: "/evaluations/finalize?memberId=demo-leader" }, { name: "開発 一郎", href: "/evaluations/finalize?memberId=demo-member1" }] },
    ],
    source: "fallback",
  };
}

export async function getEvaluationProgressBundle(teamIds?: string[]): Promise<EvaluationProgressBundle> {
  if (!hasDatabaseUrl()) {
    return buildFallbackBundle();
  }

  try {
    const period = await prisma.evaluationPeriod.findFirstOrThrow({
      where: { status: { in: [EvaluationPeriodStatus.OPEN, EvaluationPeriodStatus.DRAFT, EvaluationPeriodStatus.CLOSED] } },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    });

    const where = {
      evaluationPeriodId: period.id,
      ...(teamIds && teamIds.length > 0 ? { teamId: { in: teamIds } } : {}),
    };

    const evaluations = await prisma.employeeEvaluation.findMany({
      where,
      orderBy: [{ team: { name: "asc" } }, { user: { name: "asc" } }],
      select: {
        status: true,
        selfScoreTotal: true,
        managerScoreTotal: true,
        finalScoreTotal: true,
        userId: true,
        user: { select: { name: true } },
      },
    });

    const total = evaluations.length;
    const selfPending = evaluations.filter(
      (evaluation) => evaluation.status === EvaluationStatus.SELF_REVIEW && evaluation.selfScoreTotal === null,
    );
    const managerPending = evaluations.filter(
      (evaluation) =>
        evaluation.status !== EvaluationStatus.FINAL_REVIEW &&
        evaluation.status !== EvaluationStatus.FINALIZED &&
        evaluation.managerScoreTotal === null,
    );
    const finalPending = evaluations.filter(
      (evaluation) => evaluation.status !== EvaluationStatus.FINALIZED && evaluation.finalScoreTotal === null,
    );

    return {
      evaluationPeriodId: period.id,
      periodName: period.name,
      stats: [
        {
          label: "自己評価完了",
          completed: total - selfPending.length,
          total,
          href: "/evaluations/my",
          pendingMembers: selfPending.slice(0, 5).map((evaluation) => ({ name: evaluation.user.name, href: "/evaluations/my" })),
        },
        {
          label: "上長評価完了",
          completed: total - managerPending.length,
          total,
          href: "/evaluations/team",
          pendingMembers: managerPending.slice(0, 5).map((evaluation) => ({ name: evaluation.user.name, href: `/evaluations/team?memberId=${evaluation.userId}` })),
        },
        {
          label: "最終評価確定",
          completed: total - finalPending.length,
          total,
          href: "/evaluations/finalize",
          pendingMembers: finalPending.slice(0, 5).map((evaluation) => ({ name: evaluation.user.name, href: `/evaluations/finalize?memberId=${evaluation.userId}` })),
        },
      ],
      source: "database",
    };
  } catch {
    return buildFallbackBundle();
  }
}
