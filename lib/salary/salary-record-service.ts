import { UserStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type SalaryRecordEditorRow = {
  id: string;
  userId: string;
  employeeCode: string;
  employeeName: string;
  teamName: string;
  effectiveFrom: string;
  baseSalary: number;
  allowance: number;
  socialInsurance: number;
  otherFixedCost: number;
  total: number;
  hasPersistedRecord: boolean;
};

export type SalaryRecordBundle = {
  yearMonth: string;
  rows: SalaryRecordEditorRow[];
  source: "database" | "fallback";
};

export type SaveSalaryRecordInput = {
  yearMonth: string;
  rows: Array<{
    id: string;
    userId: string;
    effectiveFrom: string;
    baseSalary: number;
    allowance: number;
    socialInsurance: number;
    otherFixedCost: number;
  }>;
};

function getMonthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function totalOf(row: {
  baseSalary: number;
  allowance: number;
  socialInsurance: number;
  otherFixedCost: number;
}) {
  return row.baseSalary + row.allowance + row.socialInsurance + row.otherFixedCost;
}

const fallbackRows: SalaryRecordEditorRow[] = [
  {
    id: "salary-demo-member1",
    userId: "demo-member1",
    employeeCode: "E0001",
    employeeName: "開発 一郎",
    teamName: "プラットフォームチーム",
    effectiveFrom: "2026-03-01",
    baseSalary: 280000,
    allowance: 20000,
    socialInsurance: 50000,
    otherFixedCost: 20000,
    total: 370000,
    hasPersistedRecord: true,
  },
  {
    id: "salary-demo-leader",
    userId: "demo-leader",
    employeeCode: "E0002",
    employeeName: "主任 次郎",
    teamName: "プラットフォームチーム",
    effectiveFrom: "2026-03-01",
    baseSalary: 420000,
    allowance: 30000,
    socialInsurance: 70000,
    otherFixedCost: 20000,
    total: 540000,
    hasPersistedRecord: true,
  },
];

export async function getSalaryRecordBundle(yearMonth: string): Promise<SalaryRecordBundle> {
  if (!hasDatabaseUrl()) {
    return { yearMonth, rows: fallbackRows, source: "fallback" };
  }

  try {
    const { start, end } = getMonthRange(yearMonth);
    const defaultEffectiveFrom = `${yearMonth}-01`;

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
          select: {
            team: { select: { name: true } },
          },
        },
        salaryRecords: {
          where: { effectiveFrom: { lte: end } },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
          select: {
            id: true,
            effectiveFrom: true,
            baseSalary: true,
            allowance: true,
            socialInsurance: true,
            otherFixedCost: true,
          },
        },
      },
    });

    return {
      yearMonth,
      rows: users.map((user) => {
        const current = user.salaryRecords[0];
        const row = {
          id: current?.id ?? `draft-${user.id}`,
          userId: user.id,
          employeeCode: user.employeeCode,
          employeeName: user.name,
          teamName: user.teamMemberships[0]?.team.name ?? "未所属",
          effectiveFrom: current ? formatDate(current.effectiveFrom) : defaultEffectiveFrom,
          baseSalary: toNumber(current?.baseSalary),
          allowance: toNumber(current?.allowance),
          socialInsurance: toNumber(current?.socialInsurance),
          otherFixedCost: toNumber(current?.otherFixedCost),
          total: 0,
          hasPersistedRecord: Boolean(current),
        };

        return {
          ...row,
          total: totalOf(row),
        };
      }),
      source: "database",
    };
  } catch {
    return {
      yearMonth,
      rows: fallbackRows,
      source: "fallback",
    };
  }
}

export async function saveSalaryRecordBundle(input: SaveSalaryRecordInput): Promise<SalaryRecordBundle> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of input.rows) {
        const payload = {
          userId: row.userId,
          effectiveFrom: new Date(`${row.effectiveFrom}T00:00:00+09:00`),
          baseSalary: row.baseSalary,
          allowance: row.allowance,
          socialInsurance: row.socialInsurance,
          otherFixedCost: row.otherFixedCost,
        };

        if (row.id && !row.id.startsWith("draft-")) {
          await tx.salaryRecord.update({
            where: { id: row.id },
            data: payload,
          });
          continue;
        }

        await tx.salaryRecord.upsert({
          where: {
            userId_effectiveFrom: {
              userId: row.userId,
              effectiveFrom: payload.effectiveFrom,
            },
          },
          update: {
            baseSalary: row.baseSalary,
            allowance: row.allowance,
            socialInsurance: row.socialInsurance,
            otherFixedCost: row.otherFixedCost,
          },
          create: payload,
        });
      }
    });

    return getSalaryRecordBundle(input.yearMonth);
  } catch {
    return {
      yearMonth: input.yearMonth,
      rows: input.rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        employeeCode: row.userId,
        employeeName: "プレビュー社員",
        teamName: "未所属",
        effectiveFrom: row.effectiveFrom,
        baseSalary: row.baseSalary,
        allowance: row.allowance,
        socialInsurance: row.socialInsurance,
        otherFixedCost: row.otherFixedCost,
        total: totalOf(row),
        hasPersistedRecord: !row.id.startsWith("draft-"),
      })),
      source: "fallback",
    };
  }
}
