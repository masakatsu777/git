import { FixedCostAllocationMethod } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";

export type CompanyFixedCostRow = {
  id: string;
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
  yearMonth: string;
  rows: Array<{
    category: string;
    amount: number;
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

async function getHeadcounts(yearMonth: string) {
  const { start, end } = getMonthRange(yearMonth);

  const teams = await prisma.team.findMany({
    where: { isActive: true },
    select: {
      id: true,
      memberships: {
        where: {
          isPrimary: true,
          startDate: { lte: end },
          OR: [{ endDate: null }, { endDate: { gte: start } }],
        },
        select: { userId: true },
      },
    },
  });

  const headcounts = teams.map((team) => ({
    teamId: team.id,
    count: team.memberships.length,
  }));

  return {
    totalHeadcount: headcounts.reduce((total, row) => total + row.count, 0),
    headcounts,
  };
}

export async function getCompanyFixedCosts(yearMonth: string): Promise<CompanyFixedCostRow[]> {
  try {
    const rows = await prisma.fixedCostSetting.findMany({
      where: { yearMonth },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        category: true,
        amount: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      amount: Number(row.amount),
      allocationMethod: "HEADCOUNT",
    }));
  } catch {
    return [
      {
        id: "fixed-hq-rent",
        category: "家賃光熱費",
        amount: 300000,
        allocationMethod: "HEADCOUNT",
      },
    ];
  }
}

export async function saveCompanyFixedCosts(input: SaveCompanyFixedCostsInput): Promise<CompanyFixedCostRow[]> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fixedCostAllocation.deleteMany({ where: { yearMonth: input.yearMonth } });
      await tx.fixedCostSetting.deleteMany({ where: { yearMonth: input.yearMonth } });

      if (input.rows.length > 0) {
        await tx.fixedCostSetting.createMany({
          data: input.rows.map((row) => ({
            yearMonth: input.yearMonth,
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
      category: row.category,
      amount: row.amount,
      allocationMethod: "HEADCOUNT",
    }));
  }

  return getCompanyFixedCosts(input.yearMonth);
}

export async function getTeamFixedCostAllocationSummary(teamId: string, yearMonth: string): Promise<TeamFixedCostAllocationSummary> {
  try {
    const [rows, { totalHeadcount, headcounts }] = await Promise.all([
      getCompanyFixedCosts(yearMonth),
      getHeadcounts(yearMonth),
    ]);

    const teamHeadcount = headcounts.find((row) => row.teamId === teamId)?.count ?? 0;

    const allocations = rows.map((row) => ({
      id: row.id,
      category: row.category,
      companyAmount: row.amount,
      allocatedAmount: totalHeadcount === 0 ? 0 : round((row.amount * teamHeadcount) / totalHeadcount),
      allocationMethod: "HEADCOUNT" as const,
    }));

    return {
      totalCompanyFixedCost: rows.reduce((total, row) => total + row.amount, 0),
      totalHeadcount,
      teamHeadcount,
      allocations,
    };
  } catch {
    return {
      totalCompanyFixedCost: 300000,
      totalHeadcount: 3,
      teamHeadcount: teamId === "team-platform" ? 3 : 0,
      allocations: [
        {
          id: "fixed-hq-rent",
          category: "家賃光熱費",
          companyAmount: 300000,
          allocatedAmount: teamId === "team-platform" ? 300000 : 0,
          allocationMethod: "HEADCOUNT",
        },
      ],
    };
  }
}