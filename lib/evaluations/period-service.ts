import { EvaluationPeriodStatus } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";

export type EvaluationPeriodOption = {
  id: string;
  name: string;
};

export async function getEvaluationPeriodOptions(): Promise<EvaluationPeriodOption[]> {
  try {
    const periods = await prisma.evaluationPeriod.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    });

    if (periods.length > 0) {
      return periods;
    }
  } catch {}

  return [{ id: "period-2025-h2", name: "2025年度下期" }];
}

export async function resolveEvaluationPeriod(evaluationPeriodId?: string) {
  if (evaluationPeriodId) {
    return prisma.evaluationPeriod.findUniqueOrThrow({
      where: { id: evaluationPeriodId },
      select: { id: true, name: true },
    });
  }

  return prisma.evaluationPeriod.findFirstOrThrow({
    where: { status: { in: [EvaluationPeriodStatus.OPEN, EvaluationPeriodStatus.DRAFT] } },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });
}
