import { CostCategory, CostTargetType, UserStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getDepartmentMonthlyOtherCostMap } from "@/lib/pl/department-monthly-other-cost-service";
import { getCompanyFixedCosts } from "@/lib/pl/fixed-cost-service";
import { getVisibleYearMonthOptions } from "@/lib/pl/service";

type SubjectTypeFilter = "ALL" | "EMPLOYEE" | "PARTNER";
type MembershipFilter = "ALL" | "ASSIGNED" | "UNASSIGNED";

export type ProfitBreakdownFilters = {
  rangeStartYearMonth?: string;
  rangeEndYearMonth?: string;
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
  rangeStartYearMonth: string;
  rangeEndYearMonth: string;
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
    otherCostTotal: number;
    adjustedFinalGrossProfit: number;
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

function sortYearMonthsAscending(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizeRange(startYearMonth: string | undefined, endYearMonth: string | undefined, options: Array<{ yearMonth: string }>) {
  const ascending = sortYearMonthsAscending(options.map((option) => option.yearMonth));
  const fallbackStart = ascending[0] ?? "2026-03";
  const fallbackEnd = ascending[ascending.length - 1] ?? fallbackStart;
  const requestedStart = startYearMonth && ascending.includes(startYearMonth) ? startYearMonth : fallbackStart;
  const requestedEnd = endYearMonth && ascending.includes(endYearMonth) ? endYearMonth : fallbackEnd;

  return requestedStart.localeCompare(requestedEnd) <= 0
    ? { startYearMonth: requestedStart, endYearMonth: requestedEnd }
    : { startYearMonth: requestedEnd, endYearMonth: requestedStart };
}

function getYearMonthsInRange(startYearMonth: string, endYearMonth: string) {
  const values: string[] = [];
  const [startYear, startMonth] = startYearMonth.split("-").map(Number);
  const [endYear, endMonth] = endYearMonth.split("-").map(Number);
  const cursor = new Date(startYear, startMonth - 1, 1);
  const limit = new Date(endYear, endMonth - 1, 1);

  while (cursor.getTime() <= limit.getTime()) {
    values.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return values;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getProfitBreakdownBundle(input?: ProfitBreakdownFilters): Promise<ProfitBreakdownBundle> {
  const yearMonthOptions = await getVisibleYearMonthOptions();
  const { startYearMonth: resolvedRangeStartYearMonth, endYearMonth: resolvedRangeEndYearMonth } = normalizeRange(
    input?.rangeStartYearMonth,
    input?.rangeEndYearMonth,
    yearMonthOptions,
  );
  const resolvedDepartmentId = input?.departmentId ?? "";
  const resolvedTeamId = input?.teamId ?? "";
  const resolvedSubjectType = input?.subjectType ?? "ALL";
  const resolvedMembershipFilter = input?.membershipFilter ?? "ALL";
  const resolvedKeyword = input?.keyword?.trim() ?? "";
  const rangeYearMonths = getYearMonthsInRange(resolvedRangeStartYearMonth, resolvedRangeEndYearMonth);
  const rangeStart = getMonthRange(resolvedRangeStartYearMonth).start;
  const rangeEnd = getMonthRange(resolvedRangeEndYearMonth).end;

  if (!hasDatabaseUrl()) {
    return {
      rangeStartYearMonth: resolvedRangeStartYearMonth,
      rangeEndYearMonth: resolvedRangeEndYearMonth,
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
        otherCostTotal: 0,
        adjustedFinalGrossProfit: 0,
      },
      yearMonthOptions,
      departmentOptions: [{ id: "", name: "全社" }],
      teamOptions: [],
    };
  }

  const [departments, teams, employeeAssignments, unassignedEmployeeAssignments, partnerAssignments, unassignedPartnerAssignments, partnerCosts, users, fixedCostsByMonth, otherCostMapByMonth] = await Promise.all([
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
            startDate: { lte: rangeEnd },
            OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
            user: { is: { status: UserStatus.ACTIVE } },
          },
          select: { userId: true },
        },
        indirectCosts: {
          where: { yearMonth: { in: rangeYearMonths } },
          select: { amount: true, yearMonth: true },
        },
      },
    }),
    prisma.monthlyAssignment.findMany({
      where: {
        yearMonth: { in: rangeYearMonths },
        targetType: "EMPLOYEE",
        ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
        ...(resolvedDepartmentId ? { team: { departmentId: resolvedDepartmentId } } : {}),
      },
      select: {
        userId: true,
        teamId: true,
        yearMonth: true,
        salesAmount: true,
        user: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            salaryRecords: {
              where: { effectiveFrom: { lte: rangeEnd } },
              orderBy: { effectiveFrom: "desc" },
              select: {
                effectiveFrom: true,
                baseSalary: true,
                allowance: true,
                socialInsurance: true,
                otherFixedCost: true,
              },
            },
            monthlyCosts: {
              where: {
                yearMonth: { in: rangeYearMonths },
                targetType: CostTargetType.EMPLOYEE,
                costCategory: { in: [CostCategory.SALARY, CostCategory.OTHER] },
              },
              select: {
                yearMonth: true,
                costCategory: true,
                amount: true,
              },
            },
            teamMemberships: {
              where: {
                isPrimary: true,
                startDate: { lte: rangeEnd },
                OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
              },
              select: { teamId: true, startDate: true, endDate: true },
            },
          },
        },
      },
    }),
    prisma.departmentUnassignedMonthlyAssignment.findMany({
      where: {
        yearMonth: { in: rangeYearMonths },
        targetType: "EMPLOYEE",
        ...(resolvedTeamId ? { departmentId: "__no_match__" } : {}),
        ...(resolvedDepartmentId ? { departmentId: resolvedDepartmentId } : {}),
      },
      select: {
        userId: true,
        departmentId: true,
        yearMonth: true,
        salesAmount: true,
        user: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            department: { select: { id: true, name: true } },
            salaryRecords: {
              where: { effectiveFrom: { lte: rangeEnd } },
              orderBy: { effectiveFrom: "desc" },
              select: {
                effectiveFrom: true,
                baseSalary: true,
                allowance: true,
                socialInsurance: true,
                otherFixedCost: true,
              },
            },
            monthlyCosts: {
              where: {
                yearMonth: { in: rangeYearMonths },
                targetType: CostTargetType.EMPLOYEE,
                costCategory: { in: [CostCategory.SALARY, CostCategory.OTHER] },
              },
              select: {
                yearMonth: true,
                costCategory: true,
                amount: true,
              },
            },
          },
        },
      },
    }),
    prisma.monthlyAssignment.findMany({
      where: {
        yearMonth: { in: rangeYearMonths },
        targetType: "PARTNER",
        ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
        ...(resolvedDepartmentId ? { team: { departmentId: resolvedDepartmentId } } : {}),
      },
      select: {
        partnerId: true,
        teamId: true,
        salesAmount: true,
        partner: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    }),
    prisma.departmentUnassignedMonthlyAssignment.findMany({
      where: {
        yearMonth: { in: rangeYearMonths },
        targetType: "PARTNER",
        ...(resolvedTeamId ? { departmentId: "__no_match__" } : {}),
        ...(resolvedDepartmentId ? { departmentId: resolvedDepartmentId } : {}),
      },
      select: {
        partnerId: true,
        departmentId: true,
        salesAmount: true,
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
        yearMonth: { in: rangeYearMonths },
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
            startDate: { lte: rangeEnd },
            OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
          },
          select: { teamId: true },
        },
      },
    }),
    Promise.all(rangeYearMonths.map(async (yearMonth) => ({
      yearMonth,
      rows: await getCompanyFixedCosts(yearMonth),
    }))),
    getDepartmentMonthlyOtherCostMap(rangeYearMonths),
  ]);

  const departmentOptions = [{ id: "", name: "全社" }, ...departments.map((department) => ({ id: department.id, name: department.name }))];
  const departmentNameMap = new Map(departments.map((department) => [department.id, department.name]));
  const teamOptions = teams.map((team) => ({ id: team.id, name: team.name, departmentId: team.departmentId ?? "" }));

  const fixedCostContextByMonth = new Map(
    fixedCostsByMonth.map((entry) => [
      entry.yearMonth,
      {
        totalAmount: entry.rows.reduce((sum, row) => sum + row.amount, 0),
        departmentAmounts: entry.rows.reduce((map, row) => {
          for (const allocation of row.departmentAllocations) {
            map.set(allocation.departmentId, (map.get(allocation.departmentId) ?? 0) + allocation.amount);
          }
          return map;
        }, new Map<string, number>()),
      },
    ]),
  );
  const teamContextMap = new Map(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        teamName: team.name,
        departmentId: team.departmentId ?? "",
        departmentName: team.department?.name ?? "未設定",
        teamHeadcount: team.memberships.length,
        indirectCostTotalByMonth: team.indirectCosts.reduce((map, row) => {
          map.set(row.yearMonth, (map.get(row.yearMonth) ?? 0) + toNumber(row.amount));
          return map;
        }, new Map<string, number>()),
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
    const user = row.user;
    const teamContext = teamContextMap.get(row.teamId);
    if (!teamContext) {
      continue;
    }
    const membershipStatus = user.teamMemberships.length === 0 ? "UNASSIGNED" : "ASSIGNED";
    const key = membershipStatus === "UNASSIGNED" ? `${row.userId}:UNASSIGNED` : `${row.userId}:${row.teamId}`;
    const monthlyCostMap = new Map(user.monthlyCosts.map((cost) => [`${cost.yearMonth}:${cost.costCategory}`, toNumber(cost.amount)]));
    const directLaborCost = rangeYearMonths.reduce((sum, currentYearMonth) => {
      const monthEnd = getMonthRange(currentYearMonth).end;
      const salaryRecord = user.salaryRecords.find((record) => new Date(record.effectiveFrom).getTime() <= monthEnd.getTime());
      const fixedLaborCost = salaryRecord
        ? toNumber(salaryRecord.baseSalary) + toNumber(salaryRecord.allowance) + toNumber(salaryRecord.socialInsurance) + toNumber(salaryRecord.otherFixedCost)
        : 0;
      const overtimeAmount = monthlyCostMap.get(`${currentYearMonth}:${CostCategory.SALARY}`) ?? 0;
      const otherAmount = monthlyCostMap.get(`${currentYearMonth}:${CostCategory.OTHER}`) ?? 0;
      return sum + fixedLaborCost + overtimeAmount + otherAmount;
    }, 0);
    const indirectCostAllocation = membershipStatus === "ASSIGNED" && teamContext.teamHeadcount > 0
      ? rangeYearMonths.reduce((sum, currentYearMonth) => {
          const monthlyIndirectCostTotal = teamContext.indirectCostTotalByMonth.get(currentYearMonth) ?? 0;
          return sum + Math.round(monthlyIndirectCostTotal / teamContext.teamHeadcount);
        }, 0)
      : 0;
    const departmentHeadcount = departmentHeadcountMap.get(teamContext.departmentId) ?? 0;
    const fixedCostAllocation = departmentHeadcount > 0
      ? rangeYearMonths.reduce((sum, currentYearMonth) => {
          const fixedCostContext = fixedCostContextByMonth.get(currentYearMonth);
          const departmentAmount = teamContext.departmentId
            ? (fixedCostContext?.departmentAmounts.get(teamContext.departmentId) ?? 0)
            : (fixedCostContext?.totalAmount ?? 0);
          return sum + Math.round(departmentAmount / departmentHeadcount);
        }, 0)
      : 0;

    const existing = employeeRows.get(key);
    if (existing) {
      existing.salesTotal += toNumber(row.salesAmount);
      continue;
    }

    employeeRows.set(key, {
      key,
      subjectType: "EMPLOYEE",
      membershipStatus,
      entityId: user.id,
      displayName: user.name,
      secondaryLabel: user.employeeCode,
      departmentId: membershipStatus === "UNASSIGNED" ? "" : teamContext.departmentId,
      departmentName: membershipStatus === "UNASSIGNED" ? "-" : teamContext.departmentName,
      teamId: membershipStatus === "UNASSIGNED" ? "" : teamContext.teamId,
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

  for (const row of unassignedEmployeeAssignments) {
    if (!row.userId || !row.user) {
      continue;
    }
    const user = row.user;
    const departmentId = row.departmentId || user.department?.id || "";
    const departmentName = user.department?.name ?? departmentNameMap.get(departmentId) ?? "未設定";
    const key = `${row.userId}:UNASSIGNED`;
    const monthlyCostMap = new Map(user.monthlyCosts.map((cost) => [`${cost.yearMonth}:${cost.costCategory}`, toNumber(cost.amount)]));
    const directLaborCost = rangeYearMonths.reduce((sum, currentYearMonth) => {
      const monthEnd = getMonthRange(currentYearMonth).end;
      const salaryRecord = user.salaryRecords.find((record) => new Date(record.effectiveFrom).getTime() <= monthEnd.getTime());
      const fixedLaborCost = salaryRecord
        ? toNumber(salaryRecord.baseSalary) + toNumber(salaryRecord.allowance) + toNumber(salaryRecord.socialInsurance) + toNumber(salaryRecord.otherFixedCost)
        : 0;
      const overtimeAmount = monthlyCostMap.get(`${currentYearMonth}:${CostCategory.SALARY}`) ?? 0;
      const otherAmount = monthlyCostMap.get(`${currentYearMonth}:${CostCategory.OTHER}`) ?? 0;
      return sum + fixedLaborCost + overtimeAmount + otherAmount;
    }, 0);
    const departmentHeadcount = departmentHeadcountMap.get(departmentId) ?? 0;
    const fixedCostAllocation = departmentHeadcount > 0
      ? rangeYearMonths.reduce((sum, currentYearMonth) => {
          const fixedCostContext = fixedCostContextByMonth.get(currentYearMonth);
          const departmentAmount = departmentId
            ? (fixedCostContext?.departmentAmounts.get(departmentId) ?? 0)
            : (fixedCostContext?.totalAmount ?? 0);
          return sum + Math.round(departmentAmount / departmentHeadcount);
        }, 0)
      : 0;

    const existing = employeeRows.get(key);
    if (existing) {
      existing.salesTotal += toNumber(row.salesAmount);
      existing.directLaborCost = directLaborCost;
      existing.fixedCostAllocation = fixedCostAllocation;
      continue;
    }

    employeeRows.set(key, {
      key,
      subjectType: "EMPLOYEE",
      membershipStatus: "UNASSIGNED",
      entityId: user.id,
      displayName: user.name,
      secondaryLabel: user.employeeCode,
      departmentId,
      departmentName,
      teamId: "",
      teamName: "未所属",
      salesTotal: toNumber(row.salesAmount),
      directLaborCost,
      outsourcingCost: 0,
      indirectCostAllocation: 0,
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

  for (const row of unassignedPartnerAssignments) {
    if (!row.partnerId || !row.partner) {
      continue;
    }
    const departmentId = row.departmentId ?? "";
    const departmentName = departmentNameMap.get(departmentId) ?? "未設定";
    const key = `${row.partnerId}:UNASSIGNED`;
    const existing = partnerRows.get(key);
    if (existing) {
      existing.salesTotal += toNumber(row.salesAmount);
      continue;
    }
    partnerRows.set(key, {
      key,
      subjectType: "PARTNER",
      membershipStatus: "UNASSIGNED",
      entityId: row.partner.id,
      displayName: row.partner.name,
      secondaryLabel: row.partner.companyName ?? "",
      departmentId,
      departmentName,
      teamId: "",
      teamName: "未所属",
      salesTotal: toNumber(row.salesAmount),
      directLaborCost: 0,
      outsourcingCost: 0,
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

  const otherCostTotal = rangeYearMonths.reduce((sum, currentYearMonth) => {
    const departmentMap = otherCostMapByMonth.get(currentYearMonth) ?? new Map<string, number>();
    if (resolvedDepartmentId) {
      return sum + (departmentMap.get(resolvedDepartmentId) ?? 0);
    }
    if (resolvedTeamId) {
      const team = teams.find((row) => row.id === resolvedTeamId);
      const departmentId = team?.departmentId ?? "";
      return sum + (departmentId ? (departmentMap.get(departmentId) ?? 0) : 0);
    }
    return sum + Array.from(departmentMap.values()).reduce((monthSum, amount) => monthSum + amount, 0);
  }, 0);

  return {
    rangeStartYearMonth: resolvedRangeStartYearMonth,
    rangeEndYearMonth: resolvedRangeEndYearMonth,
    filters: {
      departmentId: resolvedDepartmentId,
      teamId: resolvedTeamId,
      subjectType: resolvedSubjectType,
      membershipFilter: resolvedMembershipFilter,
      keyword: resolvedKeyword,
    },
    rows,
    totals: {
      ...totals,
      otherCostTotal,
      adjustedFinalGrossProfit: totals.finalGrossProfit - otherCostTotal,
    },
    yearMonthOptions,
    departmentOptions,
    teamOptions,
  };
}
