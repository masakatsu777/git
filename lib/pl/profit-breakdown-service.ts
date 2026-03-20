import { CostCategory, CostTargetType, UserStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getCompanyFixedCosts } from "@/lib/pl/fixed-cost-service";
import { getVisibleYearMonthOptions } from "@/lib/pl/service";

type SubjectTypeFilter = "ALL" | "EMPLOYEE" | "PARTNER";
type MembershipFilter = "ALL" | "ASSIGNED" | "UNASSIGNED";

export type ProfitBreakdownFilters = {
  yearMonth?: string;
  departmentId?: string;
  teamId?: string;
  subjectType?: SubjectTypeFilter;
  membershipFilter?: MembershipFilter;
  keyword?: string;
};

export type ProfitBreakdownRow = {
  key: string;
  subjectType: "EMPLOYEE" | "PARTNER";
  membershipStatus: "ASSIGNED" | "UNASSIGNED" | "PARTNER";
  entityId: string;
  displayName: string;
  secondaryLabel: string;
  departmentId: string;
  departmentName: string;
  teamId: string;
  teamName: string;
  salesTotal: number;
  directLaborCost: number;
  outsourcingCost: number;
  indirectCostAllocation: number;
  fixedCostAllocation: number;
  finalGrossProfit: number;
  grossProfitRate: number;
};

export type ProfitBreakdownBundle = {
  yearMonth: string;
  filters: {
    departmentId: string;
    teamId: string;
    subjectType: SubjectTypeFilter;
    membershipFilter: MembershipFilter;
    keyword: string;
  };
  rows: ProfitBreakdownRow[];
  totals: {
    salesTotal: number;
    directLaborCost: number;
    outsourcingCost: number;
    indirectCostAllocation: number;
    fixedCostAllocation: number;
    finalGrossProfit: number;
  };
  yearMonthOptions: Array<{ yearMonth: string }>;
  departmentOptions: Array<{ id: string; name: string }>;
  teamOptions: Array<{ id: string; name: string; departmentId: string }>;
};

function getMonthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function latestYearMonth(options: Array<{ yearMonth: string }>) {
  return options[0]?.yearMonth ?? "2026-03";
}

export async function getProfitBreakdownBundle(input?: ProfitBreakdownFilters): Promise<ProfitBreakdownBundle> {
  const yearMonthOptions = await getVisibleYearMonthOptions();
  const resolvedYearMonth = input?.yearMonth ?? latestYearMonth(yearMonthOptions);
  const resolvedDepartmentId = input?.departmentId ?? "";
  const resolvedTeamId = input?.teamId ?? "";
  const resolvedSubjectType = input?.subjectType ?? "ALL";
  const resolvedMembershipFilter = input?.membershipFilter ?? "ALL";
  const resolvedKeyword = input?.keyword?.trim() ?? "";

  if (!hasDatabaseUrl()) {
    return {
      yearMonth: resolvedYearMonth,
      filters: {
        departmentId: resolvedDepartmentId,
        teamId: resolvedTeamId,
        subjectType: resolvedSubjectType,
        membershipFilter: resolvedMembershipFilter,
        keyword: resolvedKeyword,
      },
      rows: [],
      totals: {
        salesTotal: 0,
        directLaborCost: 0,
        outsourcingCost: 0,
        indirectCostAllocation: 0,
        fixedCostAllocation: 0,
        finalGrossProfit: 0,
      },
      yearMonthOptions,
      departmentOptions: [{ id: "", name: "全社" }],
      teamOptions: [],
    };
  }

  const { start, end } = getMonthRange(resolvedYearMonth);

  const [departments, teams, employeeAssignments, partnerAssignments, partnerCosts, users, fixedCosts] = await Promise.all([
    prisma.department.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.team.findMany({
      where: {
        isActive: true,
        ...(resolvedDepartmentId ? { departmentId: resolvedDepartmentId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        memberships: {
          where: {
            isPrimary: true,
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
            user: { is: { status: UserStatus.ACTIVE } },
          },
          select: { userId: true },
        },
        indirectCosts: {
          where: { yearMonth: resolvedYearMonth },
          select: { amount: true },
        },
      },
    }),
    prisma.monthlyAssignment.findMany({
      where: {
        yearMonth: resolvedYearMonth,
        targetType: "EMPLOYEE",
        ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
        ...(resolvedDepartmentId ? { team: { departmentId: resolvedDepartmentId } } : {}),
      },
      select: {
        userId: true,
        teamId: true,
        salesAmount: true,
        team: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
        user: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            salaryRecords: {
              where: { effectiveFrom: { lte: end } },
              orderBy: { effectiveFrom: "desc" },
              take: 1,
              select: {
                baseSalary: true,
                allowance: true,
                socialInsurance: true,
                otherFixedCost: true,
              },
            },
            monthlyCosts: {
              where: {
                yearMonth: resolvedYearMonth,
                targetType: CostTargetType.EMPLOYEE,
                costCategory: { in: [CostCategory.SALARY, CostCategory.OTHER] },
              },
              select: {
                costCategory: true,
                amount: true,
              },
            },
            teamMemberships: {
              where: {
                isPrimary: true,
                startDate: { lte: end },
                OR: [{ endDate: null }, { endDate: { gte: start } }],
              },
              select: { teamId: true },
            },
          },
        },
      },
    }),
    prisma.monthlyAssignment.findMany({
      where: {
        yearMonth: resolvedYearMonth,
        targetType: "PARTNER",
        ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
        ...(resolvedDepartmentId ? { team: { departmentId: resolvedDepartmentId } } : {}),
      },
      select: {
        partnerId: true,
        teamId: true,
        salesAmount: true,
        team: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
        partner: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    }),
    prisma.monthlyCost.findMany({
      where: {
        yearMonth: resolvedYearMonth,
        costCategory: "OUTSOURCING",
        targetType: "PARTNER",
        ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
        ...(resolvedDepartmentId ? { team: { departmentId: resolvedDepartmentId } } : {}),
      },
      select: {
        partnerId: true,
        teamId: true,
        amount: true,
      },
    }),
    prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        ...(resolvedDepartmentId ? { departmentId: resolvedDepartmentId } : {}),
      },
      select: {
        id: true,
        departmentId: true,
        teamMemberships: {
          where: {
            isPrimary: true,
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
          },
          select: { teamId: true },
        },
      },
    }),
    getCompanyFixedCosts(resolvedYearMonth),
  ]);

  const departmentOptions = [{ id: "", name: "全社" }, ...departments.map((department) => ({ id: department.id, name: department.name }))];
  const teamOptions = teams.map((team) => ({ id: team.id, name: team.name, departmentId: team.departmentId ?? "" }));

  const totalCompanyFixedCost = fixedCosts.reduce((sum, row) => sum + row.amount, 0);
  const teamContextMap = new Map(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        teamName: team.name,
        departmentId: team.departmentId ?? "",
        departmentName: team.department?.name ?? "未設定",
        teamHeadcount: team.memberships.length,
        indirectCostTotal: team.indirectCosts.reduce((sum, row) => sum + toNumber(row.amount), 0),
      },
    ]),
  );

  const departmentHeadcountMap = new Map<string, number>();
  for (const team of teams) {
    const departmentId = team.departmentId ?? "";
    departmentHeadcountMap.set(departmentId, (departmentHeadcountMap.get(departmentId) ?? 0) + team.memberships.length);
  }
  for (const user of users) {
    if (user.teamMemberships.length === 0) {
      const departmentId = user.departmentId ?? "";
      departmentHeadcountMap.set(departmentId, (departmentHeadcountMap.get(departmentId) ?? 0) + 1);
    }
  }

  const partnerCostMap = new Map<string, number>();
  for (const row of partnerCosts) {
    if (!row.partnerId || !row.teamId) {
      continue;
    }
    const key = `${row.partnerId}:${row.teamId}`;
    partnerCostMap.set(key, (partnerCostMap.get(key) ?? 0) + toNumber(row.amount));
  }

  const employeeRows = new Map<string, ProfitBreakdownRow>();
  for (const row of employeeAssignments) {
    if (!row.userId || !row.user) {
      continue;
    }
    const teamContext = teamContextMap.get(row.teamId);
    if (!teamContext) {
      continue;
    }
    const membershipStatus = row.user.teamMemberships.length === 0 ? "UNASSIGNED" : "ASSIGNED";
    const key = `${row.userId}:${row.teamId}`;
    const salaryRecord = row.user.salaryRecords[0];
    const overtimeRow = row.user.monthlyCosts.find((cost) => cost.costCategory === CostCategory.SALARY);
    const otherRow = row.user.monthlyCosts.find((cost) => cost.costCategory === CostCategory.OTHER);
    const directLaborCost = (salaryRecord
      ? toNumber(salaryRecord.baseSalary) + toNumber(salaryRecord.allowance) + toNumber(salaryRecord.socialInsurance) + toNumber(salaryRecord.otherFixedCost)
      : 0) + toNumber(overtimeRow?.amount) + toNumber(otherRow?.amount);
    const indirectCostAllocation = membershipStatus === "ASSIGNED" && teamContext.teamHeadcount > 0
      ? Math.round(teamContext.indirectCostTotal / teamContext.teamHeadcount)
      : 0;
    const departmentHeadcount = departmentHeadcountMap.get(teamContext.departmentId) ?? 0;
    const fixedCostAllocation = departmentHeadcount > 0 ? Math.round(totalCompanyFixedCost / departmentHeadcount) : 0;

    const existing = employeeRows.get(key);
    if (existing) {
      existing.salesTotal += toNumber(row.salesAmount);
      continue;
    }

    employeeRows.set(key, {
      key,
      subjectType: "EMPLOYEE",
      membershipStatus,
      entityId: row.user.id,
      displayName: row.user.name,
      secondaryLabel: row.user.employeeCode,
      departmentId: teamContext.departmentId,
      departmentName: teamContext.departmentName,
      teamId: teamContext.teamId,
      teamName: membershipStatus === "UNASSIGNED" ? "未所属" : teamContext.teamName,
      salesTotal: toNumber(row.salesAmount),
      directLaborCost,
      outsourcingCost: 0,
      indirectCostAllocation,
      fixedCostAllocation,
      finalGrossProfit: 0,
      grossProfitRate: 0,
    });
  }

  const partnerRows = new Map<string, ProfitBreakdownRow>();
  for (const row of partnerAssignments) {
    if (!row.partnerId || !row.partner) {
      continue;
    }
    const teamContext = teamContextMap.get(row.teamId);
    if (!teamContext) {
      continue;
    }
    const key = `${row.partnerId}:${row.teamId}`;
    const existing = partnerRows.get(key);
    if (existing) {
      existing.salesTotal += toNumber(row.salesAmount);
      continue;
    }
    partnerRows.set(key, {
      key,
      subjectType: "PARTNER",
      membershipStatus: "PARTNER",
      entityId: row.partner.id,
      displayName: row.partner.name,
      secondaryLabel: row.partner.companyName ?? "",
      departmentId: teamContext.departmentId,
      departmentName: teamContext.departmentName,
      teamId: teamContext.teamId,
      teamName: teamContext.teamName,
      salesTotal: toNumber(row.salesAmount),
      directLaborCost: 0,
      outsourcingCost: partnerCostMap.get(key) ?? 0,
      indirectCostAllocation: 0,
      fixedCostAllocation: 0,
      finalGrossProfit: 0,
      grossProfitRate: 0,
    });
  }

  const rows = [...employeeRows.values(), ...partnerRows.values()]
    .map((row) => {
      const finalGrossProfit =
        row.salesTotal -
        row.directLaborCost -
        row.outsourcingCost -
        row.indirectCostAllocation -
        row.fixedCostAllocation;
      const grossProfitRate = row.salesTotal > 0 ? round2((finalGrossProfit / row.salesTotal) * 100) : 0;
      return {
        ...row,
        finalGrossProfit,
        grossProfitRate,
      };
    })
    .filter((row) => {
      if (resolvedSubjectType !== "ALL" && row.subjectType !== resolvedSubjectType) {
        return false;
      }
      if (row.subjectType === "EMPLOYEE" && resolvedMembershipFilter !== "ALL" && row.membershipStatus !== resolvedMembershipFilter) {
        return false;
      }
      if (resolvedKeyword) {
        const needle = resolvedKeyword.toLowerCase();
        const haystack = `${row.displayName} ${row.secondaryLabel} ${row.departmentName} ${row.teamName}`.toLowerCase();
        if (!haystack.includes(needle)) {
          return false;
        }
      }
      return true;
    })
    .sort((left, right) => {
      if (left.subjectType !== right.subjectType) {
        return left.subjectType.localeCompare(right.subjectType);
      }
      if (left.departmentName !== right.departmentName) {
        return left.departmentName.localeCompare(right.departmentName);
      }
      if (left.teamName !== right.teamName) {
        return left.teamName.localeCompare(right.teamName);
      }
      return left.displayName.localeCompare(right.displayName);
    });

  const totals = rows.reduce(
    (sum, row) => ({
      salesTotal: sum.salesTotal + row.salesTotal,
      directLaborCost: sum.directLaborCost + row.directLaborCost,
      outsourcingCost: sum.outsourcingCost + row.outsourcingCost,
      indirectCostAllocation: sum.indirectCostAllocation + row.indirectCostAllocation,
      fixedCostAllocation: sum.fixedCostAllocation + row.fixedCostAllocation,
      finalGrossProfit: sum.finalGrossProfit + row.finalGrossProfit,
    }),
    {
      salesTotal: 0,
      directLaborCost: 0,
      outsourcingCost: 0,
      indirectCostAllocation: 0,
      fixedCostAllocation: 0,
      finalGrossProfit: 0,
    },
  );

  return {
    yearMonth: resolvedYearMonth,
    filters: {
      departmentId: resolvedDepartmentId,
      teamId: resolvedTeamId,
      subjectType: resolvedSubjectType,
      membershipFilter: resolvedMembershipFilter,
      keyword: resolvedKeyword,
    },
    rows,
    totals,
    yearMonthOptions,
    departmentOptions,
    teamOptions,
  };
}
