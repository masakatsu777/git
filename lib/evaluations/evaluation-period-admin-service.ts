import { EvaluationPeriodStatus, PeriodType } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type EvaluationPeriodAdminRow = {
  id: string;
  name: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  status: EvaluationPeriodStatus;
  evaluationCount: number;
};

export type EvaluationPeriodAdminBundle = {
  rows: EvaluationPeriodAdminRow[];
  source: "database" | "fallback";
};

export type SaveEvaluationPeriodsInput = {
  rows: Array<{
    id?: string;
    name: string;
    periodType: PeriodType;
    startDate: string;
    endDate: string;
    status: EvaluationPeriodStatus;
  }>;
};

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function fallbackRows(): EvaluationPeriodAdminRow[] {
  return [
    {
      id: "period-2025-h2",
      name: "2025年度下期",
      periodType: PeriodType.HALF_YEAR,
      startDate: "2025-10-01",
      endDate: "2026-03-31",
      status: EvaluationPeriodStatus.OPEN,
      evaluationCount: 0,
    },
  ];
}

export async function getEvaluationPeriodAdminBundle(): Promise<EvaluationPeriodAdminBundle> {
  if (!hasDatabaseUrl()) {
    return { rows: fallbackRows(), source: "fallback" };
  }

  try {
    const rows = await prisma.evaluationPeriod.findMany({
      orderBy: [{ startDate: "desc" }],
      select: {
        id: true,
        name: true,
        periodType: true,
        startDate: true,
        endDate: true,
        status: true,
        _count: { select: { employeeEvaluations: true } },
      },
    });

    return {
      source: "database",
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        periodType: row.periodType,
        startDate: formatDate(row.startDate),
        endDate: formatDate(row.endDate),
        status: row.status,
        evaluationCount: row._count.employeeEvaluations,
      })),
    };
  } catch {
    return { rows: fallbackRows(), source: "fallback" };
  }
}

function validateRows(rows: SaveEvaluationPeriodsInput["rows"]) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    name: row.name.trim(),
    startDate: row.startDate.trim(),
    endDate: row.endDate.trim(),
  }));

  if (normalizedRows.length === 0) {
    throw new Error("評価期間を1件以上登録してください。");
  }

  const openCount = normalizedRows.filter((row) => row.status === EvaluationPeriodStatus.OPEN).length;
  if (openCount > 1) {
    throw new Error("入力受付中 (OPEN) の評価期間は1件だけにしてください。");
  }

  normalizedRows.forEach((row, index) => {
    if (!row.name) {
      throw new Error(`評価期間${index + 1}件目の期間名を入力してください。`);
    }
    if (!row.startDate || !row.endDate) {
      throw new Error(`評価期間${index + 1}件目の開始日と終了日を入力してください。`);
    }

    const start = new Date(`${row.startDate}T00:00:00`);
    const end = new Date(`${row.endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error(`評価期間${index + 1}件目の日付形式が正しくありません。`);
    }
    if (start.getTime() > end.getTime()) {
      throw new Error(`評価期間${index + 1}件目は終了日を開始日以降にしてください。`);
    }
  });

  return normalizedRows;
}

export async function saveEvaluationPeriods(input: SaveEvaluationPeriodsInput): Promise<EvaluationPeriodAdminBundle> {
  const rows = validateRows(input.rows);
  if (!hasDatabaseUrl()) {
    return {
      source: "fallback",
      rows: rows.map((row, index) => ({
        id: row.id || `preview-${index}`,
        name: row.name,
        periodType: row.periodType,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        evaluationCount: 0,
      })),
    };
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const payload = {
        name: row.name,
        periodType: row.periodType,
        startDate: new Date(`${row.startDate}T00:00:00`),
        endDate: new Date(`${row.endDate}T23:59:59.999`),
        status: row.status,
      };

      if (row.id) {
        await tx.evaluationPeriod.update({
          where: { id: row.id },
          data: payload,
        });
      } else {
        await tx.evaluationPeriod.create({ data: payload });
      }
    }
  });

  return getEvaluationPeriodAdminBundle();
}
