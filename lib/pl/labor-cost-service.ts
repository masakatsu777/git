import { UserStatus } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";

export type TeamLaborCostMember = {
  userId: string;
  userName: string;
  baseSalary: number;
  allowance: number;
  socialInsurance: number;
  otherFixedCost: number;
  total: number;
  hasSalaryRecord: boolean;
};

export type TeamLaborCostSummary = {
  teamId: string;
  yearMonth: string;
  memberCount: number;
  total: number;
  members: TeamLaborCostMember[];
  source: "database" | "fallback";
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

function sumMemberCost(record: {
  baseSalary: unknown;
  allowance: unknown;
  socialInsurance: unknown;
  otherFixedCost: unknown;
}) {
  return toNumber(record.baseSalary) + toNumber(record.allowance) + toNumber(record.socialInsurance) + toNumber(record.otherFixedCost);
}

export async function getTeamLaborCostSummary(teamId: string, yearMonth: string): Promise<TeamLaborCostSummary> {
  try {
    const { start, end } = getMonthRange(yearMonth);
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: teamId },
      select: {
        id: true,
        memberships: {
          where: {
            isPrimary: true,
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
            user: { status: UserStatus.ACTIVE },
          },
          orderBy: { createdAt: "asc" },
          select: {
            user: {
              select: {
                id: true,
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
              },
            },
          },
        },
      },
    });

    const members = team.memberships.map(({ user }) => {
      const salaryRecord = user.salaryRecords[0];
      const total = salaryRecord ? sumMemberCost(salaryRecord) : 0;

      return {
        userId: user.id,
        userName: user.name,
        baseSalary: salaryRecord ? toNumber(salaryRecord.baseSalary) : 0,
        allowance: salaryRecord ? toNumber(salaryRecord.allowance) : 0,
        socialInsurance: salaryRecord ? toNumber(salaryRecord.socialInsurance) : 0,
        otherFixedCost: salaryRecord ? toNumber(salaryRecord.otherFixedCost) : 0,
        total,
        hasSalaryRecord: Boolean(salaryRecord),
      };
    });

    return {
      teamId,
      yearMonth,
      memberCount: members.length,
      total: members.reduce((sum, member) => sum + member.total, 0),
      members,
      source: "database",
    };
  } catch {
    const fallbackMembers = teamId === "team-platform"
      ? [
          {
            userId: "demo-leader",
            userName: "主任 次郎",
            baseSalary: 420000,
            allowance: 30000,
            socialInsurance: 70000,
            otherFixedCost: 20000,
            total: 540000,
            hasSalaryRecord: true,
          },
          {
            userId: "demo-member1",
            userName: "開発 一郎",
            baseSalary: 280000,
            allowance: 20000,
            socialInsurance: 50000,
            otherFixedCost: 20000,
            total: 370000,
            hasSalaryRecord: true,
          },
        ]
      : [];

    return {
      teamId,
      yearMonth,
      memberCount: fallbackMembers.length,
      total: fallbackMembers.reduce((sum, member) => sum + member.total, 0),
      members: fallbackMembers,
      source: "fallback",
    };
  }
}
