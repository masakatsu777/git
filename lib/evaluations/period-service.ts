import { EvaluationPeriodStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type EvaluationPeriodOption = {
  id: string;
  name: string;
  status: EvaluationPeriodStatus;
};

const fallbackPeriod = { id: "period-2025-h2", name: "2025年度下期", status: EvaluationPeriodStatus.OPEN } satisfies EvaluationPeriodOption;

export function getEvaluationPeriodStatusLabel(status: EvaluationPeriodStatus) {
  switch (status) {
    case EvaluationPeriodStatus.OPEN:
      return "入力受付中";
    case EvaluationPeriodStatus.CLOSED:
      return "閲覧専用";
    case EvaluationPeriodStatus.FINALIZED:
      return "最終確定済み";
    case EvaluationPeriodStatus.DRAFT:
    default:
      return "準備中";
  }
}

export async function getEvaluationPeriodOptions(): Promise<EvaluationPeriodOption[]> {
  if (!hasDatabaseUrl()) {
    return [fallbackPeriod];
  }
  try {
    const periods = await prisma.evaluationPeriod.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, status: true },
    });

    if (periods.length > 0) {
      return periods;
    }
  } catch {}

  return [fallbackPeriod];
}

export async function resolveEvaluationPeriod(evaluationPeriodId?: string) {
  if (!hasDatabaseUrl()) {
    return evaluationPeriodId ? { ...fallbackPeriod, id: evaluationPeriodId } : fallbackPeriod;
  }

  try {
    if (evaluationPeriodId) {
      return await prisma.evaluationPeriod.findUniqueOrThrow({
        where: { id: evaluationPeriodId },
        select: { id: true, name: true, status: true },
      });
    }

    return await prisma.evaluationPeriod.findFirstOrThrow({
      where: { status: { in: [EvaluationPeriodStatus.OPEN, EvaluationPeriodStatus.DRAFT] } },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, status: true },
    });
  } catch {
    return evaluationPeriodId ? { ...fallbackPeriod, id: evaluationPeriodId } : fallbackPeriod;
  }
}
