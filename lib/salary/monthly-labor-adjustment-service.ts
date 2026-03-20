import { CostCategory, CostTargetType, UserStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type MonthlyLaborAdjustmentEditorRow = {
  id: string;
  userId: string;
  employeeCode: string;
  employeeName: string;
  teamName: string;
  yearMonth: string;
  overtimeAmount: number;
  otherAmount: number;
  remarks: string;
  total: number;
  hasPersistedRecord: boolean;
};

export type MonthlyLaborAdjustmentBundle = {
  yearMonth: string;
  rows: MonthlyLaborAdjustmentEditorRow[];
  source: "database" | "fallback";
};

export type SaveMonthlyLaborAdjustmentInput = {
  yearMonth: string;
  rows: Array<{
    id: string;
    userId: string;
    overtimeAmount: number;
    otherAmount: number;
    remarks: string;
  }>;
};

function getMonthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function totalOf(row: Pick<MonthlyLaborAdjustmentEditorRow, "overtimeAmount" | "otherAmount">) {
  return row.overtimeAmount + row.otherAmount;
}

const fallbackRows: MonthlyLaborAdjustmentEditorRow[] = [
  {
    id: "monthly-labor-demo-member1",
    userId: "demo-member1",
    employeeCode: "E0001",
    employeeName: "開発 一郎",
    teamName: "プラットフォームチーム",
    yearMonth: "2026-03",
    overtimeAmount: 25000,
    otherAmount: 5000,
    remarks: "残業・夜間対応",
    total: 30000,
    hasPersistedRecord: true,
  },
];

export async function getMonthlyLaborAdjustmentBundle(yearMonth: string): Promise<MonthlyLaborAdjustmentBundle> {
  if (!hasDatabaseUrl()) {
    return { yearMonth, rows: fallbackRows.map((row) => ({ ...row, yearMonth })), source: "fallback" };
  }

  try {
    const { start, end } = getMonthRange(yearMonth);
    const users = await prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      orderBy: { employeeCode: "asc" },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        teamMemberships: {
          where: {
            isPrimary: true,
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
          },
          orderBy: [{ endDate: "desc" }, { startDate: "desc" }],
          take: 1,
          select: { team: { select: { name: true } } },
        },
        monthlyCosts: {
          where: {
            yearMonth,
            targetType: CostTargetType.EMPLOYEE,
            costCategory: { in: [CostCategory.SALARY, CostCategory.OTHER] },
          },
          select: {
            id: true,
            costCategory: true,
            amount: true,
            remarks: true,
          },
        },
      },
    });

    return {
      yearMonth,
      rows: users.map((user) => {
        const overtimeRow = user.monthlyCosts.find((row) => row.costCategory === CostCategory.SALARY);
        const otherRow = user.monthlyCosts.find((row) => row.costCategory === CostCategory.OTHER);
        const row = {
          id: overtimeRow?.id ?? otherRow?.id ?? `draft-${user.id}`,
          userId: user.id,
          employeeCode: user.employeeCode,
          employeeName: user.name,
          teamName: user.teamMemberships[0]?.team.name ?? "未所属",
          yearMonth,
          overtimeAmount: toNumber(overtimeRow?.amount),
          otherAmount: toNumber(otherRow?.amount),
          remarks: otherRow?.remarks ?? overtimeRow?.remarks ?? "",
          total: 0,
          hasPersistedRecord: Boolean(overtimeRow || otherRow),
        };

        return { ...row, total: totalOf(row) };
      }),
      source: "database",
    };
  } catch {
    return { yearMonth, rows: fallbackRows.map((row) => ({ ...row, yearMonth })), source: "fallback" };
  }
}

export async function saveMonthlyLaborAdjustmentBundle(input: SaveMonthlyLaborAdjustmentInput): Promise<MonthlyLaborAdjustmentBundle> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of input.rows) {
        await tx.monthlyCost.deleteMany({
          where: {
            userId: row.userId,
            yearMonth: input.yearMonth,
            targetType: CostTargetType.EMPLOYEE,
            costCategory: { in: [CostCategory.SALARY, CostCategory.OTHER] },
          },
        });

        const createRows: Array<{
          targetType: CostTargetType;
          userId: string;
          yearMonth: string;
          costCategory: CostCategory;
          amount: number;
          remarks?: string;
        }> = [];

        if (row.overtimeAmount !== 0) {
          createRows.push({
            targetType: CostTargetType.EMPLOYEE,
            userId: row.userId,
            yearMonth: input.yearMonth,
            costCategory: CostCategory.SALARY,
            amount: row.overtimeAmount,
            remarks: row.remarks.trim() || undefined,
          });
        }

        if (row.otherAmount !== 0 || row.remarks.trim()) {
          createRows.push({
            targetType: CostTargetType.EMPLOYEE,
            userId: row.userId,
            yearMonth: input.yearMonth,
            costCategory: CostCategory.OTHER,
            amount: row.otherAmount,
            remarks: row.remarks.trim() || undefined,
          });
        }

        if (createRows.length > 0) {
          await tx.monthlyCost.createMany({ data: createRows });
        }
      }
    });

    return getMonthlyLaborAdjustmentBundle(input.yearMonth);
  } catch {
    return {
      yearMonth: input.yearMonth,
      rows: input.rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        employeeCode: row.userId,
        employeeName: "プレビュー社員",
        teamName: "未所属",
        yearMonth: input.yearMonth,
        overtimeAmount: row.overtimeAmount,
        otherAmount: row.otherAmount,
        remarks: row.remarks,
        total: row.overtimeAmount + row.otherAmount,
        hasPersistedRecord: !row.id.startsWith("draft-"),
      })),
      source: "fallback",
    };
  }
}
