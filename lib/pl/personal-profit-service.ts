import { UserStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { calculateGrossProfit } from "@/lib/pl/calculations";
import { getDepartmentPerPersonFixedCostAllocation } from "@/lib/pl/fixed-cost-service";
import { getCompanyTargetGrossProfitRate, getVisibleYearMonthOptions } from "@/lib/pl/service";

export type PersonalProfitRow = {
  userId: string;
  employeeCode: string;
  userName: string;
  departmentId: string;
  departmentName: string;
  yearMonth: string;
  salesTotal: number;
  directLaborCost: number;
  fixedCostAllocation: number;
  finalGrossProfit: number;
  targetGrossProfitRate: number;
  actualGrossProfitRate: number;
  varianceAmount: number;
  varianceRate: number;
};

export type PersonalAnnualProfitBundle = {
  userId: string;
  userName: string;
  employeeCode: string;
  departmentName: string;
  fiscalYear: number;
  fiscalYearLabel: string;
  fiscalStartMonth: number;
  rangeStartYearMonth: string;
  rangeEndYearMonth: string;
  months: PersonalProfitRow[];
  totals: {
    salesTotal: number;
    directLaborCost: number;
    fixedCostAllocation: number;
    finalGrossProfit: number;
    grossProfitRate: number;
    varianceRate: number;
  };
  options: Array<{ fiscalYear: number; label: string }>;
  fiscalStartMonthOptions: Array<{ month: number; label: string }>;
  yearMonthOptions: Array<{ yearMonth: string }>;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function getMonthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function parseFiscalYear(yearMonth: string, fiscalStartMonth: number) {
  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return month >= fiscalStartMonth ? year : year - 1;
}

function buildFiscalYearMonths(fiscalYear: number, fiscalStartMonth: number) {
  const months: string[] = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const monthIndex = fiscalStartMonth + offset;
    const year = monthIndex <= 12 ? fiscalYear : fiscalYear + 1;
    const month = monthIndex <= 12 ? monthIndex : monthIndex - 12;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

function normalizeRange(options: string[], requestedStart?: string, requestedEnd?: string) {
  const sortedOptions = [...options].sort((a, b) => a.localeCompare(b));
  const fallbackStart = sortedOptions[0] ?? new Date().toISOString().slice(0, 7);
  const fallbackEnd = sortedOptions[sortedOptions.length - 1] ?? fallbackStart;
  let start = requestedStart && sortedOptions.includes(requestedStart) ? requestedStart : fallbackStart;
  let end = requestedEnd && sortedOptions.includes(requestedEnd) ? requestedEnd : fallbackEnd;
  if (start.localeCompare(end) > 0) {
    [start, end] = [end, start];
  }
  const months = sortedOptions.filter((yearMonth) => yearMonth.localeCompare(start) >= 0 && yearMonth.localeCompare(end) <= 0);
  return {
    start: months[0] ?? start,
    end: months[months.length - 1] ?? end,
    months: months.length > 0 ? months : [start],
  };
}

function buildFiscalYearLabel(fiscalYear: number, fiscalStartMonth: number) {
  const endMonth = fiscalStartMonth === 1 ? 12 : fiscalStartMonth - 1;
  return `${fiscalYear}年度 (${String(fiscalStartMonth).padStart(2, "0")}月開始 - ${String(endMonth).padStart(2, "0")}月締め)`;
}

function buildFiscalStartMonthLabel(month: number) {
  return `${String(month).padStart(2, "0")}月開始`;
}

export async function getPersonalMonthlyProfitByUser(userId: string, yearMonth: string): Promise<PersonalProfitRow | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const { end } = getMonthRange(yearMonth);
  const [user, companyTargetGrossProfitRate, assignedRows, unassignedRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        status: true,
        department: { select: { id: true, name: true } },
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
    getCompanyTargetGrossProfitRate(yearMonth),
    prisma.monthlyAssignment.findMany({
      where: { userId, yearMonth },
      select: { salesAmount: true },
    }),
    prisma.departmentUnassignedMonthlyAssignment.findMany({
      where: { userId, yearMonth },
      select: { salesAmount: true },
    }),
  ]);

  if (!user || user.status !== UserStatus.ACTIVE) {
    return null;
  }

  const departmentFixedCost = await getDepartmentPerPersonFixedCostAllocation(yearMonth, user.department?.id);
  const salaryRecord = user.salaryRecords[0];
  const salesTotal = assignedRows.reduce((sum, row) => sum + toNumber(row.salesAmount), 0)
    + unassignedRows.reduce((sum, row) => sum + toNumber(row.salesAmount), 0);
  const directLaborCost = salaryRecord
    ? toNumber(salaryRecord.baseSalary) + toNumber(salaryRecord.allowance) + toNumber(salaryRecord.socialInsurance) + toNumber(salaryRecord.otherFixedCost)
    : 0;

  const calculated = calculateGrossProfit({
    salesTotal,
    directLaborCost,
    outsourcingCost: 0,
    indirectCost: 0,
    fixedCostAllocation: departmentFixedCost.perPersonAmount,
    targetGrossProfitRate: companyTargetGrossProfitRate,
  });

  return {
    userId: user.id,
    employeeCode: user.employeeCode,
    userName: user.name,
    departmentId: user.department?.id ?? "",
    departmentName: user.department?.name ?? "未設定",
    yearMonth,
    salesTotal: calculated.salesTotal,
    directLaborCost: calculated.directLaborCost,
    fixedCostAllocation: calculated.fixedCostAllocation,
    finalGrossProfit: calculated.finalGrossProfit,
    targetGrossProfitRate: calculated.targetGrossProfitRate,
    actualGrossProfitRate: calculated.actualGrossProfitRate,
    varianceAmount: calculated.varianceAmount,
    varianceRate: calculated.varianceRate,
  };
}

export async function getPersonalAnnualProfitByUser(
  userId: string,
  fiscalYear?: number,
  fiscalStartMonth?: number,
  rangeStartYearMonth?: string,
  rangeEndYearMonth?: string,
): Promise<PersonalAnnualProfitBundle | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const resolvedFiscalStartMonth = fiscalStartMonth && fiscalStartMonth >= 1 && fiscalStartMonth <= 12 ? fiscalStartMonth : 4;
  const allYearMonthOptions = await getVisibleYearMonthOptions(undefined);
  const fiscalYears = Array.from(new Set(allYearMonthOptions.map((option) => parseFiscalYear(option.yearMonth, resolvedFiscalStartMonth)))).sort((a, b) => b - a);
  const resolvedFiscalYear = fiscalYear ?? fiscalYears[0] ?? new Date().getFullYear();
  const fiscalMonths = buildFiscalYearMonths(resolvedFiscalYear, resolvedFiscalStartMonth);
  const normalizedRange = normalizeRange(fiscalMonths, rangeStartYearMonth, rangeEndYearMonth);
  const months = await Promise.all(normalizedRange.months.map((yearMonth) => getPersonalMonthlyProfitByUser(userId, yearMonth)));
  const rows = months.filter((row): row is PersonalProfitRow => Boolean(row));
  const firstRow = rows[0] ?? months.find((row): row is PersonalProfitRow => Boolean(row)) ?? null;

  if (!firstRow) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, employeeCode: true, department: { select: { name: true } } },
    });
    if (!user) {
      return null;
    }
    return {
      userId: user.id,
      userName: user.name,
      employeeCode: user.employeeCode,
      departmentName: user.department?.name ?? "未設定",
      fiscalYear: resolvedFiscalYear,
      fiscalYearLabel: buildFiscalYearLabel(resolvedFiscalYear, resolvedFiscalStartMonth),
      fiscalStartMonth: resolvedFiscalStartMonth,
      rangeStartYearMonth: normalizedRange.start,
      rangeEndYearMonth: normalizedRange.end,
      months: normalizedRange.months.map((yearMonth) => ({
        userId: user.id,
        employeeCode: user.employeeCode,
        userName: user.name,
        departmentId: "",
        departmentName: user.department?.name ?? "未設定",
        yearMonth,
        salesTotal: 0,
        directLaborCost: 0,
        fixedCostAllocation: 0,
        finalGrossProfit: 0,
        targetGrossProfitRate: 0,
        actualGrossProfitRate: 0,
        varianceAmount: 0,
        varianceRate: 0,
      })),
      totals: {
        salesTotal: 0,
        directLaborCost: 0,
        fixedCostAllocation: 0,
        finalGrossProfit: 0,
        grossProfitRate: 0,
        varianceRate: 0,
      },
      options: (fiscalYears.length > 0 ? fiscalYears : [resolvedFiscalYear]).map((year) => ({ fiscalYear: year, label: buildFiscalYearLabel(year, resolvedFiscalStartMonth) })),
      fiscalStartMonthOptions: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, label: buildFiscalStartMonthLabel(index + 1) })),
      yearMonthOptions: fiscalMonths.map((yearMonth) => ({ yearMonth })),
    };
  }

  const totalSales = rows.reduce((sum, row) => sum + row.salesTotal, 0);
  const totalDirectLaborCost = rows.reduce((sum, row) => sum + row.directLaborCost, 0);
  const totalFixedCostAllocation = rows.reduce((sum, row) => sum + row.fixedCostAllocation, 0);
  const totalFinalGrossProfit = rows.reduce((sum, row) => sum + row.finalGrossProfit, 0);
  const grossProfitRate = totalSales === 0 ? 0 : round2((totalFinalGrossProfit / totalSales) * 100);
  const targetGrossProfitRate = rows.length > 0 ? round2(rows.reduce((sum, row) => sum + row.targetGrossProfitRate, 0) / rows.length) : 0;

  return {
    userId: firstRow.userId,
    userName: firstRow.userName,
    employeeCode: firstRow.employeeCode,
    departmentName: firstRow.departmentName,
    fiscalYear: resolvedFiscalYear,
    fiscalYearLabel: buildFiscalYearLabel(resolvedFiscalYear, resolvedFiscalStartMonth),
    fiscalStartMonth: resolvedFiscalStartMonth,
    rangeStartYearMonth: normalizedRange.start,
    rangeEndYearMonth: normalizedRange.end,
    months: normalizedRange.months.map((yearMonth) => rows.find((row) => row.yearMonth === yearMonth) ?? {
      ...firstRow,
      yearMonth,
      salesTotal: 0,
      directLaborCost: 0,
      fixedCostAllocation: 0,
      finalGrossProfit: 0,
      targetGrossProfitRate: firstRow.targetGrossProfitRate,
      actualGrossProfitRate: 0,
      varianceAmount: 0,
      varianceRate: round2(0 - firstRow.targetGrossProfitRate),
    }),
    totals: {
      salesTotal: totalSales,
      directLaborCost: totalDirectLaborCost,
      fixedCostAllocation: totalFixedCostAllocation,
      finalGrossProfit: totalFinalGrossProfit,
      grossProfitRate,
      varianceRate: round2(grossProfitRate - targetGrossProfitRate),
    },
    options: (fiscalYears.length > 0 ? fiscalYears : [resolvedFiscalYear]).map((year) => ({ fiscalYear: year, label: buildFiscalYearLabel(year, resolvedFiscalStartMonth) })),
    fiscalStartMonthOptions: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, label: buildFiscalStartMonthLabel(index + 1) })),
    yearMonthOptions: fiscalMonths.map((yearMonth) => ({ yearMonth })),
  };
}
