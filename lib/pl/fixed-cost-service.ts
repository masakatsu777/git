import { UserStatus, FixedCostAllocationMethod } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type CompanyFixedCostRow = {
  id: string;
  effectiveYearMonth: string;
  category: string;
  amount: number;
  allocationMethod: "HEADCOUNT";
};

export type TeamFixedCostAllocationSummary = {
  totalCompanyFixedCost: number;
  totalHeadcount: number;
  teamHeadcount: number;
  allocations: Array<{
    id: string;
    category: string;
    companyAmount: number;
    allocatedAmount: number;
    allocationMethod: "HEADCOUNT";
  }>;
};

export type SaveCompanyFixedCostsInput = {
  rows: Array<{
    effectiveYearMonth: string;
    category: string;
    amount: number;
  }>;
};

type HeadcountContext = {
  totalActiveHeadcount: number;
  unassignedHeadcount: number;
  headcounts: Array<{
    teamId: string;
    departmentId: string | null;
    count: number;
  }>;
};

function getMonthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function compareYearMonth(left: string, right: string) {
  return left.localeCompare(right);
}

function fallbackRows(): CompanyFixedCostRow[] {
  return [
    {
      id: "fixed-hq-rent",
      effectiveYearMonth: "2026-03",
      category: "家賃光熱費",
      amount: 300000,
      allocationMethod: "HEADCOUNT",
    },
  ];
}

function getLatestEffectiveYearMonth(rows: Array<{ yearMonth: string }>, targetYearMonth: string) {
  const matched = rows
    .map((row) => row.yearMonth)
    .filter((yearMonth) => compareYearMonth(yearMonth, targetYearMonth) <= 0)
    .sort((a, b) => b.localeCompare(a));

  return matched[0] ?? null;
}

async function getHeadcounts(yearMonth: string): Promise<HeadcountContext> {
  if (!hasDatabaseUrl()) {
    return {
      totalActiveHeadcount: 4,
      unassignedHeadcount: 1,
      headcounts: [{ teamId: "team-platform", departmentId: "dept-dev", count: 3 }],
    };
  }

  const { start, end } = getMonthRange(yearMonth);

  const [teams, unassignedUsers] = await Promise.all([
    prisma.team.findMany({
      where: { isActive: true },
      select: {
        id: true,
        departmentId: true,
        memberships: {
          where: {
            isPrimary: true,
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
            user: { is: { status: UserStatus.ACTIVE } },
          },
          select: { userId: true },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        teamMemberships: {
          none: {
            isPrimary: true,
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
          },
        },
      },
      select: { id: true },
    }),
  ]);

  const headcounts = teams.map((team) => ({
    teamId: team.id,
    departmentId: team.departmentId,
    count: team.memberships.length,
  }));

  const assignedHeadcount = headcounts.reduce((total, row) => total + row.count, 0);
  const unassignedHeadcount = unassignedUsers.length;

  return {
    totalActiveHeadcount: assignedHeadcount + unassignedHeadcount,
    unassignedHeadcount,
    headcounts,
  };
}

export async function getCompanyFixedCosts(yearMonth: string): Promise<CompanyFixedCostRow[]> {
  if (!hasDatabaseUrl()) {
    return fallbackRows();
  }

  try {
    const rows = await prisma.fixedCostSetting.findMany({
      where: { yearMonth: { lte: yearMonth } },
      orderBy: [{ yearMonth: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        yearMonth: true,
        category: true,
        amount: true,
      },
    });

    const latestEffectiveYearMonth = getLatestEffectiveYearMonth(rows, yearMonth);
    if (!latestEffectiveYearMonth) {
      return [];
    }

    return rows
      .filter((row) => row.yearMonth === latestEffectiveYearMonth)
      .map((row) => ({
        id: row.id,
        effectiveYearMonth: row.yearMonth,
        category: row.category,
        amount: Number(row.amount),
        allocationMethod: "HEADCOUNT",
      }));
  } catch {
    return fallbackRows();
  }
}

export async function getCompanyFixedCostSettings(): Promise<CompanyFixedCostRow[]> {
  if (!hasDatabaseUrl()) {
    return fallbackRows();
  }

  try {
    const rows = await prisma.fixedCostSetting.findMany({
      orderBy: [{ yearMonth: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        yearMonth: true,
        category: true,
        amount: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      effectiveYearMonth: row.yearMonth,
      category: row.category,
      amount: Number(row.amount),
      allocationMethod: "HEADCOUNT",
    }));
  } catch {
    return fallbackRows();
  }
}

export async function saveCompanyFixedCosts(input: SaveCompanyFixedCostsInput): Promise<CompanyFixedCostRow[]> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fixedCostAllocation.deleteMany();
      await tx.fixedCostSetting.deleteMany();

      if (input.rows.length > 0) {
        await tx.fixedCostSetting.createMany({
          data: input.rows.map((row) => ({
            yearMonth: row.effectiveYearMonth,
            category: row.category,
            amount: row.amount,
            allocationMethod: FixedCostAllocationMethod.HEADCOUNT,
          })),
        });
      }
    });
  } catch {
    return input.rows.map((row, index) => ({
      id: `preview-${index}`,
      effectiveYearMonth: row.effectiveYearMonth,
      category: row.category,
      amount: row.amount,
      allocationMethod: "HEADCOUNT",
    }));
  }

  return getCompanyFixedCostSettings();
}

export async function getPerPersonFixedCostAllocation(yearMonth: string): Promise<{
  totalCompanyFixedCost: number;
  totalHeadcount: number;
  perPersonAmount: number;
}> {
  const [rows, headcounts] = await Promise.all([
    getCompanyFixedCosts(yearMonth),
    getHeadcounts(yearMonth),
  ]);

  const totalCompanyFixedCost = rows.reduce((total, row) => total + row.amount, 0);
  const totalHeadcount = headcounts.totalActiveHeadcount;

  return {
    totalCompanyFixedCost,
    totalHeadcount,
    perPersonAmount: totalHeadcount === 0 ? 0 : round(totalCompanyFixedCost / totalHeadcount),
  };
}

export async function getTeamFixedCostAllocationSummary(teamId: string, yearMonth: string): Promise<TeamFixedCostAllocationSummary> {
  try {
    const [rows, { totalActiveHeadcount, headcounts }, team] = await Promise.all([
      getCompanyFixedCosts(yearMonth),
      getHeadcounts(yearMonth),
      prisma.team.findUnique({
        where: { id: teamId },
        select: { departmentId: true },
      }),
    ]);

    const teamHeadcount = headcounts.find((row) => row.teamId === teamId)?.count ?? 0;
    const scopeHeadcount = team?.departmentId
      ? headcounts.filter((row) => row.departmentId === team.departmentId).reduce((total, row) => total + row.count, 0)
      : totalActiveHeadcount;

    const allocations = rows.map((row) => ({
      id: row.id,
      category: row.category,
      companyAmount: row.amount,
      allocatedAmount: scopeHeadcount === 0 ? 0 : round((row.amount * teamHeadcount) / scopeHeadcount),
      allocationMethod: "HEADCOUNT" as const,
    }));

    return {
      totalCompanyFixedCost: rows.reduce((total, row) => total + row.amount, 0),
      totalHeadcount: scopeHeadcount,
      teamHeadcount,
      allocations,
    };
  } catch {
    return {
      totalCompanyFixedCost: 300000,
      totalHeadcount: 4,
      teamHeadcount: teamId === "team-platform" ? 3 : 0,
      allocations: [
        {
          id: "fixed-hq-rent",
          category: "家賃光熱費",
          companyAmount: 300000,
          allocatedAmount: teamId === "team-platform" ? 225000 : 0,
          allocationMethod: "HEADCOUNT",
        },
      ],
    };
  }
}
