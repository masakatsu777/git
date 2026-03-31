import { UserStatus, FixedCostAllocationMethod } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type DepartmentAllocationRow = {
  departmentId: string;
  departmentName: string;
  amount: number;
};

export type CompanyFixedCostRow = {
  id: string;
  effectiveYearMonth: string;
  effectiveEndYearMonth: string | null;
  category: string;
  amount: number;
  allocationMethod: "HEADCOUNT";
  departmentAllocations: DepartmentAllocationRow[];
};

export type CompanyFixedCostSettingsBundle = {
  rows: CompanyFixedCostRow[];
  departmentOptions: Array<{ departmentId: string; departmentName: string }>;
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
    effectiveEndYearMonth: string | null;
    category: string;
    amount: number;
    departmentAllocations: Array<{
      departmentId: string;
      amount: number;
    }>;
  }>;
};

type HeadcountContext = {
  totalActiveHeadcount: number;
  unassignedHeadcountByDepartment: Record<string, number>;
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
      effectiveEndYearMonth: null,
      category: "全社固定費",
      amount: 300000,
      allocationMethod: "HEADCOUNT",
      departmentAllocations: [
        { departmentId: "dept-dev", departmentName: "開発本部", amount: 300000 },
      ],
    },
  ];
}

function fallbackDepartmentOptions() {
  return [
    { departmentId: "dept-dev", departmentName: "開発本部" },
    { departmentId: "dept-sales", departmentName: "営業本部" },
  ];
}

function isYearMonthActive(startYearMonth: string, endYearMonth: string | null | undefined, targetYearMonth: string) {
  if (compareYearMonth(startYearMonth, targetYearMonth) > 0) {
    return false;
  }

  if (endYearMonth && compareYearMonth(targetYearMonth, endYearMonth) > 0) {
    return false;
  }

  return true;
}

async function getDepartmentOptions() {
  if (!hasDatabaseUrl()) {
    return fallbackDepartmentOptions();
  }

  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return departments.map((department) => ({
      departmentId: department.id,
      departmentName: department.name,
    }));
  } catch {
    return fallbackDepartmentOptions();
  }
}

async function getHeadcounts(yearMonth: string): Promise<HeadcountContext> {
  if (!hasDatabaseUrl()) {
    return {
      totalActiveHeadcount: 4,
      unassignedHeadcountByDepartment: { "dept-dev": 1 },
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
      select: { id: true, departmentId: true },
    }),
  ]);

  const headcounts = teams.map((team) => ({
    teamId: team.id,
    departmentId: team.departmentId,
    count: team.memberships.length,
  }));

  const assignedHeadcount = headcounts.reduce((total, row) => total + row.count, 0);
  const unassignedHeadcountByDepartment = unassignedUsers.reduce<Record<string, number>>((map, user) => {
    if (!user.departmentId) {
      return map;
    }
    map[user.departmentId] = (map[user.departmentId] ?? 0) + 1;
    return map;
  }, {});

  return {
    totalActiveHeadcount: assignedHeadcount + unassignedUsers.length,
    unassignedHeadcountByDepartment,
    headcounts,
  };
}

function toCompanyFixedCostRows(rows: Array<{
  id: string;
  yearMonth: string;
  endYearMonth: string | null;
  category: string;
  amount: number;
  departmentAllocations: Array<{ departmentId: string; departmentName: string; amount: number }>;
}>): CompanyFixedCostRow[] {
  return rows.map((row) => ({
    id: row.id,
    effectiveYearMonth: row.yearMonth,
    effectiveEndYearMonth: row.endYearMonth,
    category: row.category,
    amount: row.amount,
    allocationMethod: "HEADCOUNT",
    departmentAllocations: row.departmentAllocations,
  }));
}

export async function getCompanyFixedCosts(yearMonth: string): Promise<CompanyFixedCostRow[]> {
  if (!hasDatabaseUrl()) {
    return fallbackRows().filter((row) => isYearMonthActive(row.effectiveYearMonth, row.effectiveEndYearMonth, yearMonth));
  }

  try {
    const rows = await prisma.fixedCostSetting.findMany({
      orderBy: [{ yearMonth: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        yearMonth: true,
        endYearMonth: true,
        category: true,
        amount: true,
        departmentAllocations: {
          select: {
            departmentId: true,
            amount: true,
            department: { select: { name: true } },
          },
          orderBy: { department: { name: "asc" } },
        },
      },
    });

    return toCompanyFixedCostRows(
      rows
        .filter((row) => isYearMonthActive(row.yearMonth, row.endYearMonth, yearMonth))
        .map((row) => ({
          id: row.id,
          yearMonth: row.yearMonth,
          endYearMonth: row.endYearMonth,
          category: row.category,
          amount: Number(row.amount),
          departmentAllocations: row.departmentAllocations.map((allocation) => ({
            departmentId: allocation.departmentId,
            departmentName: allocation.department.name,
            amount: Number(allocation.amount),
          })),
        })),
    );
  } catch (error) {
    console.error("Failed to load company fixed costs", { yearMonth, error });
    return [];
  }
}

export async function getCompanyFixedCostSettingsBundle(): Promise<CompanyFixedCostSettingsBundle> {
  if (!hasDatabaseUrl()) {
    return {
      rows: fallbackRows(),
      departmentOptions: fallbackDepartmentOptions(),
    };
  }

  try {
    const [rows, departmentOptions] = await Promise.all([
      prisma.fixedCostSetting.findMany({
        orderBy: [{ yearMonth: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          yearMonth: true,
          endYearMonth: true,
          category: true,
          amount: true,
          departmentAllocations: {
            select: {
              departmentId: true,
              amount: true,
              department: { select: { name: true } },
            },
            orderBy: { department: { name: "asc" } },
          },
        },
      }),
      getDepartmentOptions(),
    ]);

    return {
      rows: toCompanyFixedCostRows(rows.map((row) => ({
        id: row.id,
        yearMonth: row.yearMonth,
        endYearMonth: row.endYearMonth,
        category: row.category,
        amount: Number(row.amount),
        departmentAllocations: row.departmentAllocations.map((allocation) => ({
          departmentId: allocation.departmentId,
          departmentName: allocation.department.name,
          amount: Number(allocation.amount),
        })),
      }))),
      departmentOptions,
    };
  } catch (error) {
    console.error("Failed to load company fixed cost settings", { error });
    return {
      rows: [],
      departmentOptions: await getDepartmentOptions(),
    };
  }
}

export async function saveCompanyFixedCosts(input: SaveCompanyFixedCostsInput): Promise<CompanyFixedCostSettingsBundle> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fixedCostAllocation.deleteMany();
      await tx.departmentFixedCostAllocation.deleteMany();
      await tx.fixedCostSetting.deleteMany();

      for (const row of input.rows) {
        const created = await tx.fixedCostSetting.create({
          data: {
            yearMonth: row.effectiveYearMonth,
            category: row.category,
            amount: row.amount,
            allocationMethod: FixedCostAllocationMethod.HEADCOUNT,
          },
          select: { id: true },
        });

        if (row.departmentAllocations.length > 0) {
          await tx.departmentFixedCostAllocation.createMany({
            data: row.departmentAllocations.map((allocation) => ({
              fixedCostSettingId: created.id,
              departmentId: allocation.departmentId,
              amount: allocation.amount,
            })),
          });
        }
      }
    });
  } catch (error) {
    console.error("Failed to save company fixed costs", { error });
    return {
      rows: input.rows.map((row, index) => ({
        id: `preview-${index}`,
        effectiveYearMonth: row.effectiveYearMonth,
        effectiveEndYearMonth: row.effectiveEndYearMonth,
        category: row.category,
        amount: row.amount,
        allocationMethod: "HEADCOUNT",
        departmentAllocations: row.departmentAllocations.map((allocation) => ({
          departmentId: allocation.departmentId,
          departmentName: allocation.departmentId,
          amount: allocation.amount,
        })),
      })),
      departmentOptions: await getDepartmentOptions(),
    };
  }

  return getCompanyFixedCostSettingsBundle();
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


export async function getDepartmentPerPersonFixedCostAllocation(yearMonth: string, departmentId?: string | null): Promise<{
  totalDepartmentFixedCost: number;
  departmentHeadcount: number;
  perPersonAmount: number;
}> {
  const [rows, { totalActiveHeadcount, headcounts, unassignedHeadcountByDepartment }] = await Promise.all([
    getCompanyFixedCosts(yearMonth),
    getHeadcounts(yearMonth),
  ]);

  const normalizedDepartmentId = departmentId ?? "";
  const departmentHeadcount = normalizedDepartmentId
    ? headcounts.filter((row) => row.departmentId === normalizedDepartmentId).reduce((total, row) => total + row.count, 0)
      + (unassignedHeadcountByDepartment[normalizedDepartmentId] ?? 0)
    : totalActiveHeadcount;
  const totalDepartmentFixedCost = rows.reduce((total, row) => {
    const amount = normalizedDepartmentId
      ? row.departmentAllocations.find((allocation) => allocation.departmentId === normalizedDepartmentId)?.amount ?? 0
      : row.amount;
    return total + amount;
  }, 0);

  return {
    totalDepartmentFixedCost,
    departmentHeadcount,
    perPersonAmount: departmentHeadcount === 0 ? 0 : round(totalDepartmentFixedCost / departmentHeadcount),
  };
}

export async function getTeamFixedCostAllocationSummary(teamId: string, yearMonth: string): Promise<TeamFixedCostAllocationSummary> {
  try {
    const [rows, { totalActiveHeadcount, headcounts, unassignedHeadcountByDepartment }, team] = await Promise.all([
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
        + (unassignedHeadcountByDepartment[team.departmentId] ?? 0)
      : totalActiveHeadcount;

    const allocations = rows.map((row) => {
      const departmentAmount = team?.departmentId
        ? row.departmentAllocations.find((allocation) => allocation.departmentId === team.departmentId)?.amount ?? 0
        : row.amount;

      return {
        id: row.id,
        category: row.category,
        companyAmount: departmentAmount,
        allocatedAmount: scopeHeadcount === 0 ? 0 : round((departmentAmount * teamHeadcount) / scopeHeadcount),
        allocationMethod: "HEADCOUNT" as const,
      };
    });

    return {
      totalCompanyFixedCost: allocations.reduce((total, row) => total + row.companyAmount, 0),
      totalHeadcount: scopeHeadcount,
      teamHeadcount,
      allocations,
    };
  } catch (error) {
    console.error("Failed to load team fixed cost allocation summary", { teamId, yearMonth, error });
    return {
      totalCompanyFixedCost: 0,
      totalHeadcount: 0,
      teamHeadcount: 0,
      allocations: [],
    };
  }
}
