import { EvaluationPeriodStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type EvaluationPeriodOption = {
  id: string;
  name: string;
};

const fallbackPeriod = { id: "period-2025-h2", name: "2025年度下期" } satisfies EvaluationPeriodOption;

export async function getEvaluationPeriodOptions(): Promise<EvaluationPeriodOption[]> {
  if (!hasDatabaseUrl()) {
    return [fallbackPeriod];
  }
  try {
    const periods = await prisma.evaluationPeriod.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    });

    if (periods.length > 0) {
      return periods;
    }
  } catch {}

  return [fallbackPeriod];
}

export async function resolveEvaluationPeriod(evaluationPeriodId?: string) {
  if (!hasDatabaseUrl()) {
    return evaluationPeriodId ? { id: evaluationPeriodId, name: fallbackPeriod.name } : fallbackPeriod;
  }

  try {
    if (evaluationPeriodId) {
      return await prisma.evaluationPeriod.findUniqueOrThrow({
        where: { id: evaluationPeriodId },
        select: { id: true, name: true },
      });
    }

    return await prisma.evaluationPeriod.findFirstOrThrow({
      where: { status: { in: [EvaluationPeriodStatus.OPEN, EvaluationPeriodStatus.DRAFT] } },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    });
  } catch {
    return evaluationPeriodId ? { id: evaluationPeriodId, name: fallbackPeriod.name } : fallbackPeriod;
  }
}
