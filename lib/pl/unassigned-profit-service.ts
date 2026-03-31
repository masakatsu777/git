import { UserStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { calculateGrossProfit } from "@/lib/pl/calculations";
import { getPerPersonFixedCostAllocation } from "@/lib/pl/fixed-cost-service";
import { getCompanyTargetGrossProfitRate } from "@/lib/pl/service";

export type UnassignedPersonalProfitRow = {
  userId: string;
  employeeCode: string;
  userName: string;
  departmentId: string;
  departmentName: string;
  salesTotal: number;
  directLaborCost: number;
  fixedCostAllocation: number;
  finalGrossProfit: number;
  targetGrossProfitRate: number;
  actualGrossProfitRate: number;
  varianceAmount: number;
  varianceRate: number;
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

export async function getUnassignedPersonalProfitRows(yearMonth: string): Promise<UnassignedPersonalProfitRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const { start, end } = getMonthRange(yearMonth);
  const [users, perPersonFixedCost, companyTargetGrossProfitRate] = await Promise.all([
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
      orderBy: [{ employeeCode: "asc" }],
      select: {
        id: true,
        employeeCode: true,
        name: true,
        department: { select: { id: true, name: true } },
        departmentUnassignedMonthlyAssignments: {
          where: { yearMonth },
          select: { salesAmount: true },
        },
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
    }),
    getPerPersonFixedCostAllocation(yearMonth),
    getCompanyTargetGrossProfitRate(yearMonth),
  ]);

  return users.map((user) => {
    const salaryRecord = user.salaryRecords[0];
    const salesTotal = user.departmentUnassignedMonthlyAssignments.reduce((sum, row) => sum + toNumber(row.salesAmount), 0);
    const directLaborCost = salaryRecord
      ? toNumber(salaryRecord.baseSalary) + toNumber(salaryRecord.allowance) + toNumber(salaryRecord.socialInsurance) + toNumber(salaryRecord.otherFixedCost)
      : 0;

    const calculated = calculateGrossProfit({
      salesTotal,
      directLaborCost,
      outsourcingCost: 0,
      indirectCost: 0,
      fixedCostAllocation: perPersonFixedCost.perPersonAmount,
      targetGrossProfitRate: companyTargetGrossProfitRate,
    });

    return {
      userId: user.id,
      employeeCode: user.employeeCode,
      userName: user.name,
      departmentId: user.department?.id ?? "",
      departmentName: user.department?.name ?? "未設定",
      salesTotal: calculated.salesTotal,
      directLaborCost: calculated.directLaborCost,
      fixedCostAllocation: calculated.fixedCostAllocation,
      finalGrossProfit: calculated.finalGrossProfit,
      targetGrossProfitRate: calculated.targetGrossProfitRate,
      actualGrossProfitRate: calculated.actualGrossProfitRate,
      varianceAmount: calculated.varianceAmount,
      varianceRate: calculated.varianceRate,
    };
  });
}

export async function getUnassignedPersonalProfitByUser(userId: string, yearMonth: string): Promise<UnassignedPersonalProfitRow | null> {
  const rows = await getUnassignedPersonalProfitRows(yearMonth);
  return rows.find((row) => row.userId === userId) ?? null;
}
