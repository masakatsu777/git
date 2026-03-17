import type { EmployeeRecord } from "@/lib/employee-data";
import { employees as mockEmployees } from "@/lib/employee-data";
import { prisma } from "@/lib/server/prisma";

type TeamSummary = EmployeeRecord["teamSummary"];
type TeamSummaryMap = Map<string, TeamSummary>;

type EvaluationRecord = {
  status: string;
  selfComment: string | null;
  managerComment: string | null;
  finalComment: string | null;
  updatedAt: Date;
};

type UserRecord = {
  employeeCode: string;
  name: string;
  joinedAt: Date;
  role: {
    name: string;
  };
  department: {
    name: string;
  } | null;
  teamMemberships: Array<{
    teamId: string;
    team: {
      id: string;
      name: string;
    };
  }>;
  employeeEvaluations: EvaluationRecord[];
};

type TeamTargetRecord = {
  teamId: string;
  yearMonth: string;
  salesTarget: unknown;
  grossProfitTarget: unknown;
  grossProfitRateTarget: unknown;
};

type MonthlyAssignmentRecord = {
  teamId: string;
  yearMonth: string;
  partnerId: string | null;
  salesAmount: unknown;
};

type MonthlyCostRecord = {
  teamId: string | null;
  yearMonth: string;
  amount: unknown;
};

type TeamIndirectCostRecord = {
  teamId: string;
  yearMonth: string;
  amount: unknown;
};

type FixedCostAllocationRecord = {
  teamId: string;
  yearMonth: string;
  allocatedAmount: unknown;
};

type TeamMembershipRecord = {
  teamId: string;
};

const dayInMs = 1000 * 60 * 60 * 24;

function toNumber(value: unknown) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (typeof value === "object" && "toNumber" in (value as Record<string, unknown>)) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value);
}

function fallbackEmployee(employeeCode: string) {
  return mockEmployees.find((employee) => employee.id === employeeCode);
}

function requirePrisma() {
  if (!prisma) {
    throw new Error("Prisma client is not available");
  }

  return prisma;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayInMs);
}

function getLastUpdatedDaysAgo(updatedAt: Date) {
  const diff = Date.now() - updatedAt.getTime();
  return Math.max(0, Math.floor(diff / dayInMs));
}

function mapTone(status: string | undefined, fallbackTone: string | undefined) {
  if (status === "SELF_REVIEW") {
    return "ふりかえり更新待ち";
  }

  if (status === "MANAGER_REVIEW") {
    return "次回1on1で確認";
  }

  if (status === "FINAL_REVIEW") {
    return "伴走中";
  }

  if (status === "FINALIZED") {
    return "運用改善中";
  }

  return fallbackTone ?? "伴走中";
}

function getNextOneOnOneDate(evaluation: EvaluationRecord | undefined, fallbackDate: string | undefined) {
  if (!evaluation) {
    return fallbackDate ?? formatDate(new Date());
  }

  const offsetDaysByStatus: Record<string, number> = {
    SELF_REVIEW: 2,
    MANAGER_REVIEW: 5,
    FINAL_REVIEW: 7,
    FINALIZED: 14,
  };

  const offsetDays = offsetDaysByStatus[evaluation.status] ?? 7;
  return formatDate(addDays(evaluation.updatedAt, offsetDays));
}

async function fetchUsers() {
  const db = requirePrisma();

  const users = await db.user.findMany({
    include: {
      role: true,
      department: true,
      teamMemberships: {
        where: {
          isPrimary: true,
        },
        orderBy: {
          startDate: "desc",
        },
        take: 1,
        include: {
          team: true,
        },
      },
      employeeEvaluations: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      employeeCode: "asc",
    },
  });

  return users as UserRecord[];
}

async function buildTeamSummaryMap(users: UserRecord[]): Promise<TeamSummaryMap> {
  const db = requirePrisma();
  const teamIds = Array.from(new Set(users.map((user) => user.teamMemberships[0]?.teamId).filter(Boolean)));

  if (teamIds.length === 0) {
    return new Map();
  }

  const [targets, assignments, costs, indirectCosts, fixedAllocations, memberships] = await Promise.all([
    db.teamTarget.findMany({
      where: { teamId: { in: teamIds } },
      orderBy: { yearMonth: "desc" },
    }) as Promise<TeamTargetRecord[]>,
    db.monthlyAssignment.findMany({
      where: { teamId: { in: teamIds } },
      orderBy: { yearMonth: "desc" },
    }) as Promise<MonthlyAssignmentRecord[]>,
    db.monthlyCost.findMany({
      where: { teamId: { in: teamIds } },
      orderBy: { yearMonth: "desc" },
    }) as Promise<MonthlyCostRecord[]>,
    db.teamIndirectCost.findMany({
      where: { teamId: { in: teamIds } },
      orderBy: { yearMonth: "desc" },
    }) as Promise<TeamIndirectCostRecord[]>,
    db.fixedCostAllocation.findMany({
      where: { teamId: { in: teamIds } },
      orderBy: { yearMonth: "desc" },
    }) as Promise<FixedCostAllocationRecord[]>,
    db.teamMembership.findMany({
      where: { teamId: { in: teamIds }, isPrimary: true },
    }) as Promise<TeamMembershipRecord[]>,
  ]);

  const summaryMap = new Map<string, TeamSummary>();

  for (const teamId of teamIds) {
    const target = targets.find((item) => item.teamId === teamId);
    const fallbackMonth = assignments.find((item) => item.teamId === teamId)?.yearMonth ?? "-";
    const yearMonth = target?.yearMonth ?? fallbackMonth;

    const teamAssignments = assignments.filter((item) => item.teamId === teamId && item.yearMonth === yearMonth);
    const teamCosts = costs.filter((item) => item.teamId === teamId && item.yearMonth === yearMonth);
    const teamIndirect = indirectCosts.filter((item) => item.teamId === teamId && item.yearMonth === yearMonth);
    const teamFixed = fixedAllocations.filter((item) => item.teamId === teamId && item.yearMonth === yearMonth);

    const sales = teamAssignments.reduce((sum, item) => sum + toNumber(item.salesAmount), 0);
    const directCost = teamCosts.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const indirectCost = teamIndirect.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const fixedCostAllocation = teamFixed.reduce((sum, item) => sum + toNumber(item.allocatedAmount), 0);
    const totalCost = directCost + indirectCost + fixedCostAllocation;
    const grossProfit = sales - totalCost;
    const grossProfitRate = sales > 0 ? Number(((grossProfit / sales) * 100).toFixed(1)) : 0;
    const teamMembers = memberships.filter((item) => item.teamId === teamId).length;
    const partners = new Set(teamAssignments.filter((item) => item.partnerId).map((item) => item.partnerId)).size;

    summaryMap.set(teamId, {
      yearMonth,
      sales,
      salesTarget: toNumber(target?.salesTarget),
      grossProfit,
      grossProfitTarget: toNumber(target?.grossProfitTarget),
      grossProfitRate,
      grossProfitRateTarget: toNumber(target?.grossProfitRateTarget),
      totalCost,
      directCost,
      indirectCost,
      fixedCostAllocation,
      teamMembers,
      partners,
    });
  }

  return summaryMap;
}

function buildEmployeeRecord(user: UserRecord, teamSummaryMap: TeamSummaryMap): EmployeeRecord {
  const membership = user.teamMemberships[0];
  const team = membership?.team;
  const fallback = fallbackEmployee(user.employeeCode);
  const latestEvaluation = user.employeeEvaluations[0];

  return {
    id: user.employeeCode,
    name: user.name,
    role: user.role.name,
    team: team?.name ?? fallback?.team ?? "未所属",
    department: user.department?.name ?? fallback?.department ?? "未設定",
    theme: latestEvaluation?.selfComment ?? fallback?.theme ?? "成長テーマを整理中",
    nextAction: latestEvaluation?.managerComment ?? fallback?.nextAction ?? "次の一歩を設定してください",
    tone: mapTone(latestEvaluation?.status, fallback?.tone),
    joinedAt: user.joinedAt.toISOString().slice(0, 10),
    lastUpdatedDaysAgo: latestEvaluation ? getLastUpdatedDaysAgo(latestEvaluation.updatedAt) : (fallback?.lastUpdatedDaysAgo ?? 0),
    nextOneOnOneDate: getNextOneOnOneDate(latestEvaluation, fallback?.nextOneOnOneDate),
    focus: fallback?.focus ?? [],
    recentNote: latestEvaluation?.finalComment ?? latestEvaluation?.managerComment ?? fallback?.recentNote ?? "記録を準備中です。",
    teamSummary:
      (team?.id ? teamSummaryMap.get(team.id) : undefined) ??
      fallback?.teamSummary ?? {
        yearMonth: "-",
        sales: 0,
        salesTarget: 0,
        grossProfit: 0,
        grossProfitTarget: 0,
        grossProfitRate: 0,
        grossProfitRateTarget: 0,
        totalCost: 0,
        directCost: 0,
        indirectCost: 0,
        fixedCostAllocation: 0,
        teamMembers: 0,
        partners: 0,
      },
  };
}

export async function getEmployeeRecordsFromDb(): Promise<EmployeeRecord[]> {
  const users = await fetchUsers();
  const summaryMap = await buildTeamSummaryMap(users);
  return users.map((user) => buildEmployeeRecord(user, summaryMap));
}

export async function getEmployeeRecords(): Promise<EmployeeRecord[]> {
  try {
    return await getEmployeeRecordsFromDb();
  } catch {
    return mockEmployees;
  }
}

export async function getEmployeeRecordByCode(employeeCode: string): Promise<EmployeeRecord | undefined> {
  const records = await getEmployeeRecords();
  return records.find((employee) => employee.id === employeeCode);
}
