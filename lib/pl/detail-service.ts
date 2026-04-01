/* eslint-disable @typescript-eslint/no-explicit-any */
import { AssignmentTargetType, CostCategory, CostTargetType } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getTeamFixedCostAllocationSummary } from "@/lib/pl/fixed-cost-service";
import { getTeamLaborCostSummary } from "@/lib/pl/labor-cost-service";

function normalizeSalesAmount(unitPrice: number, workRate: number) {
  return Math.round((unitPrice * workRate) / 100);
}

export type AssignmentDetail = {
  id: string;
  targetType: "EMPLOYEE" | "PARTNER";
  userId: string | null;
  partnerId: string | null;
  label: string;
  unitPrice: number;
  salesAmount: number;
  workRate: number;
  remarks: string;
};

export type OutsourcingCostDetail = {
  id: string;
  partnerId: string | null;
  label: string;
  amount: number;
  remarks: string;
};

export type TeamExpenseDetail = {
  id: string;
  category: string;
  amount: number;
  remarks: string;
};

export type PlDetailOption = {
  id: string;
  label: string;
  defaultUnitPrice: number;
  defaultWorkRate: number;
  defaultOutsourceAmount?: number;
};

export type TeamMonthlyDetailBundle = {
  teamId: string;
  teamName: string;
  departmentId: string;
  yearMonth: string;
  assignments: AssignmentDetail[];
  outsourcingCosts: OutsourcingCostDetail[];
  teamExpenses: TeamExpenseDetail[];
  directLaborCostTotal: number;
  fixedCostSummary: {
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
  salesTarget: number;
  grossProfitTarget: number;
  grossProfitRateTarget: number;
  employeeOptions: PlDetailOption[];
  unassignedEmployeeIds: string[];
  unassignedEmployeeOptions: PlDetailOption[];
  unassignedPartnerIds: string[];
  unassignedPartnerOptions: PlDetailOption[];
  partnerOptions: PlDetailOption[];
  source: "database" | "fallback";
};

export type SaveTeamMonthlyDetailsInput = {
  teamId: string;
  yearMonth: string;
  assignments: Array<{
    targetType: "EMPLOYEE" | "PARTNER";
    userId: string | null;
    partnerId: string | null;
    partnerName: string;
    unitPrice: number;
    salesAmount: number;
    workRate: number;
    remarks: string;
  }>;
  outsourcingCosts: Array<{
    partnerId: string | null;
    partnerName: string;
    amount: number;
    remarks: string;
  }>;
  teamExpenses: Array<{
    category: string;
    amount: number;
    remarks: string;
  }>;
  salesTarget: number;
  grossProfitTarget: number;
  grossProfitRateTarget: number;
};

export type SaveTeamMonthlyDetailsResult = {
  persisted: boolean;
  bundle: TeamMonthlyDetailBundle;
};

function parseYearMonth(yearMonth: string) {
  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("年月の形式が不正です");
  }

  return { year, month };
}

export function getPreviousYearMonth(yearMonth: string) {
  const { year, month } = parseYearMonth(yearMonth);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return `${previousYear}-${String(previousMonth).padStart(2, "0")}`;
}

const fallbackSummary = {
  totalCompanyFixedCost: 300000,
  totalHeadcount: 3,
  teamHeadcount: 3,
  allocations: [
    {
      id: "fixed-1",
      category: "家賃光熱費",
      companyAmount: 300000,
      allocatedAmount: 300000,
      allocationMethod: "HEADCOUNT" as const,
    },
  ],
};

const fallbackBundle: TeamMonthlyDetailBundle = {
  teamId: "team-platform",
  teamName: "プラットフォームチーム",
  departmentId: "",
  yearMonth: "2026-03",
  assignments: [
    {
      id: "assignment-leader",
      targetType: "EMPLOYEE",
      userId: "demo-leader",
      partnerId: null,
      label: "主任 次郎",
      unitPrice: 950000,
      salesAmount: 950000,
      workRate: 100,
      remarks: "基幹案件",
    },
    {
      id: "assignment-member1",
      targetType: "EMPLOYEE",
      userId: "demo-member1",
      partnerId: null,
      label: "開発 一郎",
      unitPrice: 800000,
      salesAmount: 800000,
      workRate: 100,
      remarks: "開発支援",
    },
    {
      id: "assignment-partner",
      targetType: "PARTNER",
      userId: null,
      partnerId: "partner-001",
      label: "協力会社A",
      unitPrice: 700000,
      salesAmount: 700000,
      workRate: 100,
      remarks: "外部要員",
    },
  ],
  outsourcingCosts: [
    {
      id: "outsource-1",
      partnerId: "partner-001",
      label: "協力会社A",
      amount: 620000,
      remarks: "準委任費用",
    },
  ],
  teamExpenses: [
    {
      id: "expense-1",
      category: "採用教育費",
      amount: 120000,
      remarks: "勉強会・採用活動",
    },
    {
      id: "expense-2",
      category: "その他経費",
      amount: 30000,
      remarks: "チーム会食",
    },
  ],
  directLaborCostTotal: 910000,
  fixedCostSummary: fallbackSummary,
  salesTarget: 2500000,
  grossProfitTarget: 800000,
  grossProfitRateTarget: 32,
  employeeOptions: [
    { id: "demo-leader", label: "主任 次郎", defaultUnitPrice: 950000, defaultWorkRate: 100 },
    { id: "demo-member1", label: "開発 一郎", defaultUnitPrice: 800000, defaultWorkRate: 100 },
    { id: "demo-member2", label: "開発 二郎", defaultUnitPrice: 780000, defaultWorkRate: 100 },
  ],
  unassignedEmployeeIds: [],
  unassignedEmployeeOptions: [],
  unassignedPartnerIds: [],
  unassignedPartnerOptions: [],
  partnerOptions: [{ id: "partner-001", label: "協力会社A", defaultUnitPrice: 700000, defaultWorkRate: 100, defaultOutsourceAmount: 620000 }],
  source: "fallback",
};

function num(value: unknown): number {
  return Number(value ?? 0);
}

function isUnassignedPartner(remarks: string | null | undefined) {
  return !remarks;
}

export async function getTeamMonthlyDetails(teamId: string, yearMonth: string, options?: { includeUnassignedEmployeeOptions?: boolean }): Promise<TeamMonthlyDetailBundle> {
  if (!hasDatabaseUrl()) {
    return {
      ...fallbackBundle,
      teamId,
      yearMonth,
      fixedCostSummary: teamId === "team-platform" ? fallbackSummary : { ...fallbackSummary, teamHeadcount: 0, allocations: fallbackSummary.allocations.map((row) => ({ ...row, allocatedAmount: 0 })) },
      source: "fallback",
    };
  }

  try {
    const { year, month } = parseYearMonth(yearMonth);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const team: any = await prisma.team.findUniqueOrThrow({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        departmentId: true,
        assignments: {
          where: { yearMonth },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            targetType: true,
            userId: true,
            partnerId: true,
            unitPrice: true,
            salesAmount: true,
            workRate: true,
            remarks: true,
            user: { select: { name: true } },
            partner: { select: { name: true } },
          },
        },
        costs: {
          where: { yearMonth, costCategory: CostCategory.OUTSOURCING },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            partnerId: true,
            amount: true,
            remarks: true,
            partner: { select: { name: true } },
          },
        },
        indirectCosts: {
          where: { yearMonth },
          orderBy: { createdAt: "asc" },
          select: { id: true, category: true, amount: true, remarks: true },
        },
        targets: {
          where: { yearMonth },
          take: 1,
          select: {
            salesTarget: true,
            grossProfitTarget: true,
            grossProfitRateTarget: true,
          },
        },
        memberships: {
          where: { endDate: null },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                employeeSalesRateSettings: {
                  where: { effectiveFrom: { lte: monthEnd } },
                  orderBy: { effectiveFrom: "desc" },
                  take: 1,
                  select: {
                    unitPrice: true,
                    defaultWorkRate: true,
                  },
                },
              },
            },
          },
        },
      },
    } as any);

    const includeUnassignedEmployeeOptions = options?.includeUnassignedEmployeeOptions ?? false;

    const [partnersResult, unassignedEmployeesResult, unassignedPartnersResult, fixedCostSummaryResult, laborCostSummaryResult] = await Promise.allSettled([
      prisma.partner.findMany({
        where: {
          status: "ACTIVE",
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          salesRateSettings: {
            where: { effectiveFrom: { lte: monthEnd } },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
            select: {
              unitPrice: true,
              defaultWorkRate: true,
              remarks: true,
            },
          },
          outsourceRateSettings: {
            where: { effectiveFrom: { lte: monthEnd } },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
            select: {
              amount: true,
            },
          },
        },
      } as any),
      team.departmentId
        ? prisma.user.findMany({
            where: {
              status: "ACTIVE",
              departmentId: team.departmentId,
              teamMemberships: {
                none: {
                  isPrimary: true,
                  startDate: { lte: monthEnd },
                  OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
                },
              },
            },
            orderBy: [{ employeeCode: "asc" }],
            select: {
              id: true,
              name: true,
              employeeSalesRateSettings: {
                where: { effectiveFrom: { lte: monthEnd } },
                orderBy: { effectiveFrom: "desc" },
                take: 1,
                select: {
                  unitPrice: true,
                  defaultWorkRate: true,
                },
              },
            },
          } as any)
        : Promise.resolve([]),
      prisma.partner.findMany({
            where: {
              status: "ACTIVE",
            },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              salesRateSettings: {
                where: { effectiveFrom: { lte: monthEnd } },
                orderBy: { effectiveFrom: "desc" },
                take: 1,
                select: {
                  unitPrice: true,
                  defaultWorkRate: true,
                  remarks: true,
                },
              },
              outsourceRateSettings: {
                where: { effectiveFrom: { lte: monthEnd } },
                orderBy: { effectiveFrom: "desc" },
                take: 1,
                select: {
                  amount: true,
                },
              },
            },
          } as any),
      getTeamFixedCostAllocationSummary(teamId, yearMonth),
      getTeamLaborCostSummary(teamId, yearMonth),
    ]);
    if (partnersResult.status === "rejected") {
      console.error("Failed to load partner options for monthly PL details", { teamId, yearMonth, error: partnersResult.reason });
    }
    if (unassignedEmployeesResult.status === "rejected") {
      console.error("Failed to load unassigned employee options for monthly PL details", { teamId, yearMonth, error: unassignedEmployeesResult.reason });
    }
    if (unassignedPartnersResult.status === "rejected") {
      console.error("Failed to load unassigned partner options for monthly PL details", { teamId, yearMonth, error: unassignedPartnersResult.reason });
    }
    if (fixedCostSummaryResult.status === "rejected") {
      console.error("Failed to load fixed cost summary for monthly PL details", { teamId, yearMonth, error: fixedCostSummaryResult.reason });
    }
    if (laborCostSummaryResult.status === "rejected") {
      console.error("Failed to load labor cost summary for monthly PL details", { teamId, yearMonth, error: laborCostSummaryResult.reason });
    }

    const partners: any[] = (partnersResult.status === "fulfilled" ? (partnersResult.value as any[]) : []).filter((row: any) => row.salesRateSettings[0]?.remarks === teamId);
    const unassignedEmployees: any[] = unassignedEmployeesResult.status === "fulfilled" ? (unassignedEmployeesResult.value as any[]) : [];
    const unassignedPartners: any[] = (unassignedPartnersResult.status === "fulfilled" ? (unassignedPartnersResult.value as any[]) : []).filter((row: any) => isUnassignedPartner(row.salesRateSettings[0]?.remarks));
    const fixedCostSummary = fixedCostSummaryResult.status === "fulfilled"
      ? fixedCostSummaryResult.value
      : { totalCompanyFixedCost: 0, totalHeadcount: 0, teamHeadcount: 0, allocations: [] };
    const laborCostSummary = laborCostSummaryResult.status === "fulfilled"
      ? laborCostSummaryResult.value
      : { teamId, yearMonth, memberCount: 0, total: 0, members: [], source: "fallback" as const };

    const target = team.targets[0];

    return {
      teamId: team.id,
      teamName: team.name,
      departmentId: team.departmentId ?? "",
      yearMonth,
      assignments: team.assignments.map((row: any) => ({
        id: row.id,
        targetType: row.targetType,
        userId: row.userId,
        partnerId: row.partnerId,
        label: row.user?.name ?? row.partner?.name ?? "未設定",
        unitPrice: num(row.unitPrice),
        salesAmount: num(row.salesAmount),
        workRate: num(row.workRate),
        remarks: row.remarks ?? "",
      })),
      outsourcingCosts: team.costs.map((row: any) => ({
        id: row.id,
        partnerId: row.partnerId,
        label: row.partner?.name ?? "未設定",
        amount: num(row.amount),
        remarks: row.remarks ?? "",
      })),
      teamExpenses: team.indirectCosts.map((row: any) => ({
        id: row.id,
        category: row.category,
        amount: num(row.amount),
        remarks: row.remarks ?? "",
      })),
      directLaborCostTotal: laborCostSummary.total,
      fixedCostSummary,
      salesTarget: num(target?.salesTarget),
      grossProfitTarget: num(target?.grossProfitTarget),
      grossProfitRateTarget: num(target?.grossProfitRateTarget),
      employeeOptions: team.memberships.map((row: any) => ({
        id: row.user.id,
        label: row.user.name,
        defaultUnitPrice: num(row.user.employeeSalesRateSettings[0]?.unitPrice),
        defaultWorkRate: num(row.user.employeeSalesRateSettings[0]?.defaultWorkRate ?? 100),
      })),
      unassignedEmployeeIds: unassignedEmployees.map((row) => row.id),
      unassignedEmployeeOptions: includeUnassignedEmployeeOptions
        ? unassignedEmployees.map((row) => ({
            id: row.id,
            label: row.name,
            defaultUnitPrice: num(row.employeeSalesRateSettings[0]?.unitPrice),
            defaultWorkRate: num(row.employeeSalesRateSettings[0]?.defaultWorkRate ?? 100),
          }))
        : [],
      unassignedPartnerIds: unassignedPartners.map((row) => row.id),
      unassignedPartnerOptions: includeUnassignedEmployeeOptions
        ? unassignedPartners.map((row) => ({
            id: row.id,
            label: row.name,
            defaultUnitPrice: num(row.salesRateSettings[0]?.unitPrice),
            defaultWorkRate: num(row.salesRateSettings[0]?.defaultWorkRate ?? 100),
          }))
        : [],
      partnerOptions: partners.map((row) => ({
        id: row.id,
        label: row.name,
        defaultUnitPrice: num(row.salesRateSettings[0]?.unitPrice),
        defaultWorkRate: num(row.salesRateSettings[0]?.defaultWorkRate ?? 100),
        defaultOutsourceAmount: num(row.outsourceRateSettings[0]?.amount),
      })),
      source: "database",
    };
  } catch (error) {
    console.error("Failed to load monthly PL detail bundle", { teamId, yearMonth, error });
    return {
      ...fallbackBundle,
      teamId,
      yearMonth,
      fixedCostSummary: teamId === "team-platform" ? fallbackSummary : { ...fallbackSummary, teamHeadcount: 0, allocations: fallbackSummary.allocations.map((row) => ({ ...row, allocatedAmount: 0 })) },
      source: "fallback",
    };
  }
}

export async function copyPreviousTeamMonthlyDetails(teamId: string, yearMonth: string): Promise<SaveTeamMonthlyDetailsResult> {
  const previousYearMonth = getPreviousYearMonth(yearMonth);
  const currentBundle = await getTeamMonthlyDetails(teamId, yearMonth);

  if (!hasDatabaseUrl()) {
    const previousBundle = await getTeamMonthlyDetails(teamId, previousYearMonth);
    return {
      persisted: false,
      bundle: {
        ...currentBundle,
        assignments: previousBundle.assignments,
        outsourcingCosts: previousBundle.outsourcingCosts,
        teamExpenses: previousBundle.teamExpenses,
        salesTarget: previousBundle.salesTarget,
        grossProfitTarget: previousBundle.grossProfitTarget,
        grossProfitRateTarget: previousBundle.grossProfitRateTarget,
      },
    };
  }

  const previousCounts = await prisma.$transaction(async (tx) => {
    const [assignmentCount, outsourcingCount, teamExpenseCount, targetCount] = await Promise.all([
      tx.monthlyAssignment.count({ where: { teamId, yearMonth: previousYearMonth } }),
      tx.monthlyCost.count({ where: { teamId, yearMonth: previousYearMonth, costCategory: CostCategory.OUTSOURCING } }),
      tx.teamIndirectCost.count({ where: { teamId, yearMonth: previousYearMonth } }),
      tx.teamTarget.count({ where: { teamId, yearMonth: previousYearMonth } }),
    ]);

    return { assignmentCount, outsourcingCount, teamExpenseCount, targetCount };
  });

  const hasPreviousData = Object.values(previousCounts).some((count) => count > 0);
  if (!hasPreviousData) {
    throw new Error(`前月(${previousYearMonth})の明細データがありません`);
  }

  const previousBundle = await getTeamMonthlyDetails(teamId, previousYearMonth);

  return saveTeamMonthlyDetails({
    teamId,
    yearMonth,
    assignments: previousBundle.assignments.map((row) => ({
      targetType: row.targetType,
      userId: row.userId,
      partnerId: row.partnerId,
      partnerName: row.targetType === "PARTNER" ? row.label : "",
      unitPrice: row.unitPrice,
      salesAmount: normalizeSalesAmount(row.unitPrice, row.workRate),
      workRate: row.workRate,
      remarks: row.remarks,
    })),
    outsourcingCosts: previousBundle.outsourcingCosts.map((row) => ({
      partnerId: row.partnerId,
      partnerName: row.label,
      amount: row.amount,
      remarks: row.remarks,
    })),
    teamExpenses: previousBundle.teamExpenses.map((row) => ({
      category: row.category,
      amount: row.amount,
      remarks: row.remarks,
    })),
    salesTarget: previousBundle.salesTarget,
    grossProfitTarget: previousBundle.grossProfitTarget,
    grossProfitRateTarget: previousBundle.grossProfitRateTarget,
  });
}

export async function saveTeamMonthlyDetails(input: SaveTeamMonthlyDetailsInput): Promise<SaveTeamMonthlyDetailsResult> {
  try {
    const { year, month } = parseYearMonth(input.yearMonth);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const team = await prisma.team.findUniqueOrThrow({
      where: { id: input.teamId },
      select: { id: true, name: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.monthlyAssignment.deleteMany({ where: { teamId: input.teamId, yearMonth: input.yearMonth } });
      await tx.monthlyCost.deleteMany({
        where: { teamId: input.teamId, yearMonth: input.yearMonth, costCategory: CostCategory.OUTSOURCING },
      });
      await tx.teamIndirectCost.deleteMany({ where: { teamId: input.teamId, yearMonth: input.yearMonth } });

      const resolvePartnerId = async (partnerId: string | null, partnerName: string) => {
        const normalizedName = partnerName.trim();

        if (partnerId) {
          const existingById = await tx.partner.findUnique({
            where: { id: partnerId },
            select: { id: true, name: true },
          });

          if (existingById && (!normalizedName || existingById.name === normalizedName)) {
            return existingById.id;
          }
        }

        if (!normalizedName) {
          return null;
        }

        const existingByName = await tx.partner.findFirst({
          where: { name: normalizedName },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });

        if (existingByName) {
          return existingByName.id;
        }

        const created = await tx.partner.create({
          data: {
            name: normalizedName,
          },
          select: { id: true },
        });

        return created.id;
      };

      const syncPartnerJurisdiction = async (partnerId: string | null, unitPrice: number, workRate: number) => {
        if (!partnerId) {
          return;
        }

        const effectiveFrom = monthStart;
        const existing = await (tx.partnerSalesRateSetting as any).findFirst({
          where: {
            partnerId,
            effectiveFrom: { lte: monthEnd },
          },
          orderBy: { effectiveFrom: "desc" },
          select: { id: true, remarks: true },
        });

        if (existing) {
          if (!existing.remarks) {
            await (tx.partnerSalesRateSetting as any).update({
              where: { id: existing.id },
              data: { remarks: input.teamId },
            });
          }
          return;
        }

        await (tx.partnerSalesRateSetting as any).create({
          data: {
            partnerId,
            effectiveFrom,
            unitPrice,
            defaultWorkRate: workRate,
            remarks: input.teamId,
          },
        });
      };

      if (input.assignments.length > 0) {
        const assignmentRows = await Promise.all(input.assignments.map(async (row) => {
          const resolvedPartnerId = row.targetType === "PARTNER" ? await resolvePartnerId(row.partnerId, row.partnerName) : null;
          await syncPartnerJurisdiction(resolvedPartnerId, row.unitPrice, row.workRate);
          return {
            targetType: row.targetType === "EMPLOYEE" ? AssignmentTargetType.EMPLOYEE : AssignmentTargetType.PARTNER,
            userId: row.targetType === "EMPLOYEE" ? row.userId : null,
            partnerId: resolvedPartnerId,
            teamId: input.teamId,
            yearMonth: input.yearMonth,
            unitPrice: row.unitPrice,
            salesAmount: normalizeSalesAmount(row.unitPrice, row.workRate),
            workRate: row.workRate,
            remarks: row.remarks || null,
          };
        }));

        await tx.monthlyAssignment.createMany({
          data: assignmentRows,
        });
      }

      if (input.outsourcingCosts.length > 0) {
        const outsourcingRows = await Promise.all(input.outsourcingCosts.map(async (row) => {
          const resolvedPartnerId = await resolvePartnerId(row.partnerId, row.partnerName);
          await syncPartnerJurisdiction(resolvedPartnerId, 0, 100);
          return {
            targetType: CostTargetType.PARTNER,
            partnerId: resolvedPartnerId,
            teamId: input.teamId,
            yearMonth: input.yearMonth,
            costCategory: CostCategory.OUTSOURCING,
            amount: row.amount,
            remarks: row.remarks || null,
          };
        }));

        await tx.monthlyCost.createMany({
          data: outsourcingRows,
        });
      }

      if (input.teamExpenses.length > 0) {
        await tx.teamIndirectCost.createMany({
          data: input.teamExpenses.map((row) => ({
            teamId: input.teamId,
            yearMonth: input.yearMonth,
            category: row.category,
            amount: row.amount,
            remarks: row.remarks || null,
          })),
        });
      }

    });

    return {
      persisted: true,
      bundle: await getTeamMonthlyDetails(team.id, input.yearMonth),
    };
  } catch {
    const fallback = await getTeamMonthlyDetails(input.teamId, input.yearMonth);
    return {
      persisted: false,
      bundle: fallback,
    };
  }
}







export type SaveUnassignedMonthlySalesInput = {
  teamId: string;
  yearMonth: string;
  assignments: Array<{
    targetType: "EMPLOYEE" | "PARTNER";
    userId: string | null;
    partnerId: string | null;
    partnerName: string;
    unitPrice: number;
    salesAmount: number;
    workRate: number;
    remarks: string;
  }>;
};

export async function saveUnassignedMonthlySales(input: SaveUnassignedMonthlySalesInput): Promise<SaveTeamMonthlyDetailsResult> {
  if (!hasDatabaseUrl()) {
    return {
      persisted: false,
      bundle: await getTeamMonthlyDetails(input.teamId, input.yearMonth, { includeUnassignedEmployeeOptions: true }),
    };
  }

  const { year, month } = parseYearMonth(input.yearMonth);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: input.teamId },
      select: { id: true, departmentId: true },
    });

    const requestedUserIds = input.assignments.filter((row) => row.targetType === "EMPLOYEE").map((row) => row.userId).filter((value): value is string => Boolean(value));
    const requestedPartnerIds = input.assignments.filter((row) => row.targetType === "PARTNER").map((row) => row.partnerId).filter((value): value is string => Boolean(value));
    const eligibleUsers = requestedUserIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: {
            id: { in: requestedUserIds },
            status: "ACTIVE",
            departmentId: team.departmentId,
            teamMemberships: {
              none: {
                isPrimary: true,
                startDate: { lte: monthEnd },
                OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
              },
            },
          },
          select: { id: true },
        });

    const eligibleUserIds = new Set(eligibleUsers.map((user) => user.id));
    const eligiblePartners = requestedPartnerIds.length === 0
      ? []
      : await prisma.partner.findMany({
          where: {
            id: { in: requestedPartnerIds },
            status: "ACTIVE",
          },
          select: {
            id: true,
            salesRateSettings: {
              where: { effectiveFrom: { lte: monthEnd } },
              orderBy: { effectiveFrom: "desc" },
              take: 1,
              select: { remarks: true },
            },
          },
        } as any);
    const eligiblePartnerIds = new Set((eligiblePartners as any[]).filter((partner: any) => isUnassignedPartner(partner.salesRateSettings[0]?.remarks)).map((partner: any) => partner.id));

    await prisma.$transaction(async (tx) => {
      if (team.departmentId) {
        const existingEligibleUsers = await tx.user.findMany({
          where: {
            status: "ACTIVE",
            departmentId: team.departmentId,
            teamMemberships: {
              none: {
                isPrimary: true,
                startDate: { lte: monthEnd },
                OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
              },
            },
          },
          select: { id: true },
        });

        await tx.monthlyAssignment.deleteMany({
          where: {
            teamId: input.teamId,
            yearMonth: input.yearMonth,
            targetType: AssignmentTargetType.EMPLOYEE,
            userId: { in: existingEligibleUsers.map((user) => user.id) },
          },
        });
      }

      const existingEligiblePartners = (await tx.partner.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
          salesRateSettings: {
            where: { effectiveFrom: { lte: monthEnd } },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
            select: { remarks: true },
          },
        },
      } as any)).filter((partner: any) => isUnassignedPartner(partner.salesRateSettings[0]?.remarks));

      await tx.monthlyAssignment.deleteMany({
        where: {
          teamId: input.teamId,
          yearMonth: input.yearMonth,
          targetType: AssignmentTargetType.PARTNER,
          partnerId: { in: existingEligiblePartners.map((partner) => partner.id) },
        },
      });

      if (input.assignments.length > 0) {
        const employeeRows = input.assignments
          .filter((row): row is typeof row & { userId: string } => row.targetType === "EMPLOYEE" && Boolean(row.userId) && eligibleUserIds.has(row.userId as string))
          .map((row) => ({
            targetType: AssignmentTargetType.EMPLOYEE,
            userId: row.userId,
            partnerId: null,
            teamId: input.teamId,
            yearMonth: input.yearMonth,
            unitPrice: row.unitPrice,
            salesAmount: row.salesAmount,
            workRate: row.workRate,
            remarks: row.remarks || null,
          }));

        const partnerRows = input.assignments
          .filter((row): row is typeof row & { partnerId: string } => row.targetType === "PARTNER" && Boolean(row.partnerId) && eligiblePartnerIds.has(row.partnerId as string))
          .map((row) => ({
            targetType: AssignmentTargetType.PARTNER,
            userId: null,
            partnerId: row.partnerId,
            teamId: input.teamId,
            yearMonth: input.yearMonth,
            unitPrice: row.unitPrice,
            salesAmount: row.salesAmount,
            workRate: row.workRate,
            remarks: row.remarks || null,
          }));

        const rows = [...employeeRows, ...partnerRows];

        if (rows.length > 0) {
          await tx.monthlyAssignment.createMany({ data: rows });
        }
      }
    });

    return {
      persisted: true,
      bundle: await getTeamMonthlyDetails(input.teamId, input.yearMonth, { includeUnassignedEmployeeOptions: true }),
    };
  } catch {
    return {
      persisted: false,
      bundle: await getTeamMonthlyDetails(input.teamId, input.yearMonth, { includeUnassignedEmployeeOptions: true }),
    };
  }
}
