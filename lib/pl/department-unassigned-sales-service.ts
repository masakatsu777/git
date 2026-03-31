import { AssignmentTargetType, UserStatus, type Prisma } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getVisibleYearMonthOptions } from "@/lib/pl/service";

function normalizeSalesAmount(unitPrice: number, workRate: number) {
  return Math.round((unitPrice * workRate) / 100);
}

export type DepartmentOption = {
  id: string;
  name: string;
};

export type DepartmentUnassignedSalesOption = {
  id: string;
  label: string;
  defaultUnitPrice: number;
  defaultWorkRate: number;
  defaultOutsourceAmount?: number;
};

export type DepartmentUnassignedSalesAssignment = {
  id: string;
  targetType: "EMPLOYEE" | "PARTNER";
  userId: string | null;
  partnerId: string | null;
  label: string;
  unitPrice: number;
  salesAmount: number;
  outsourcingCost: number;
  workRate: number;
  remarks: string;
};

export type DepartmentUnassignedSalesBundle = {
  departmentId: string;
  departmentName: string;
  yearMonth: string;
  departmentOptions: DepartmentOption[];
  yearMonthOptions: Array<{ yearMonth: string }>;
  assignments: DepartmentUnassignedSalesAssignment[];
  employeeOptions: DepartmentUnassignedSalesOption[];
  partnerOptions: DepartmentUnassignedSalesOption[];
  source: "database" | "fallback";
};

export type SaveDepartmentUnassignedSalesInput = {
  departmentId: string;
  yearMonth: string;
  assignments: Array<{
    targetType: "EMPLOYEE" | "PARTNER";
    userId: string | null;
    partnerId: string | null;
    partnerName: string;
    unitPrice: number;
    salesAmount: number;
    outsourcingCost: number;
    workRate: number;
    remarks: string;
  }>;
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

function num(value: unknown): number {
  return Number(value ?? 0);
}

async function getDepartmentOptions(): Promise<DepartmentOption[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  try {
    const rows = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return rows;
  } catch {
    return [];
  }
}

export async function getDepartmentUnassignedSalesBundle(
  departmentId?: string,
  yearMonth?: string,
  options?: { includeOptions?: boolean },
): Promise<DepartmentUnassignedSalesBundle> {
  const resolvedYearMonth = yearMonth ?? "2026-03";
  const departmentOptions = await getDepartmentOptions();
  const resolvedDepartmentId = departmentId && departmentOptions.some((row) => row.id == departmentId)
    ? departmentId
    : departmentOptions[0]?.id ?? "";
  const resolvedDepartmentName = departmentOptions.find((row) => row.id === resolvedDepartmentId)?.name ?? "未設定";
  const yearMonthOptions = await getVisibleYearMonthOptions(undefined);

  if (!hasDatabaseUrl() || !resolvedDepartmentId) {
    return {
      departmentId: resolvedDepartmentId,
      departmentName: resolvedDepartmentName,
      yearMonth: resolvedYearMonth,
      departmentOptions,
      yearMonthOptions,
      assignments: [],
      employeeOptions: [],
      partnerOptions: [],
      source: "fallback",
    };
  }

  const includeOptions = options?.includeOptions ?? false;
  const { year, month } = parseYearMonth(resolvedYearMonth);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    const [rows, employees, partners] = await Promise.all([
      prisma.departmentUnassignedMonthlyAssignment.findMany({
        where: { departmentId: resolvedDepartmentId, yearMonth: resolvedYearMonth },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          targetType: true,
          userId: true,
          partnerId: true,
          unitPrice: true,
          salesAmount: true,
          outsourcingCost: true,
          workRate: true,
          remarks: true,
          user: { select: { name: true } },
          partner: { select: { name: true } },
        },
      }),
      includeOptions
        ? prisma.user.findMany({
            where: {
              status: UserStatus.ACTIVE,
              departmentId: resolvedDepartmentId,
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
              employeeSalesRateSetting: {
                select: {
                  unitPrice: true,
                  defaultWorkRate: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      includeOptions
        ? prisma.partner.findMany({
            where: {
              status: "ACTIVE",
              OR: [
                { salesRateSetting: null },
                { salesRateSetting: { is: { remarks: null } } },
                { salesRateSetting: { is: { remarks: "" } } },
              ],
            },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              salesRateSetting: {
                select: {
                  unitPrice: true,
                  defaultWorkRate: true,
                },
              },
              outsourceRateSetting: {
                select: {
                  amount: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      departmentId: resolvedDepartmentId,
      departmentName: resolvedDepartmentName,
      yearMonth: resolvedYearMonth,
      departmentOptions,
      yearMonthOptions,
      assignments: rows.map((row) => ({
        id: row.id,
        targetType: row.targetType,
        userId: row.userId,
        partnerId: row.partnerId,
        label: row.user?.name ?? row.partner?.name ?? "未設定",
        unitPrice: num(row.unitPrice),
        salesAmount: num(row.salesAmount),
        outsourcingCost: num(row.outsourcingCost),
        workRate: num(row.workRate),
        remarks: row.remarks ?? "",
      })),
      employeeOptions: employees.map((row) => ({
        id: row.id,
        label: row.name,
        defaultUnitPrice: num(row.employeeSalesRateSetting?.unitPrice),
        defaultWorkRate: num(row.employeeSalesRateSetting?.defaultWorkRate ?? 100),
      })),
      partnerOptions: partners.map((row) => ({
        id: row.id,
        label: row.name,
        defaultUnitPrice: num(row.salesRateSetting?.unitPrice),
        defaultWorkRate: num(row.salesRateSetting?.defaultWorkRate ?? 100),
        defaultOutsourceAmount: num(row.outsourceRateSetting?.amount),
      })),
      source: "database",
    };
  } catch (error) {
    console.error("Failed to load department unassigned sales bundle", { departmentId: resolvedDepartmentId, yearMonth: resolvedYearMonth, error });
    return {
      departmentId: resolvedDepartmentId,
      departmentName: resolvedDepartmentName,
      yearMonth: resolvedYearMonth,
      departmentOptions,
      yearMonthOptions,
      assignments: [],
      employeeOptions: [],
      partnerOptions: [],
      source: "fallback",
    };
  }
}

export async function saveDepartmentUnassignedSales(input: SaveDepartmentUnassignedSalesInput): Promise<{ persisted: boolean; bundle: DepartmentUnassignedSalesBundle }> {
  if (!hasDatabaseUrl()) {
    return {
      persisted: false,
      bundle: await getDepartmentUnassignedSalesBundle(input.departmentId, input.yearMonth, { includeOptions: true }),
    };
  }

  const { year, month } = parseYearMonth(input.yearMonth);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    const requestedUserIds = input.assignments
      .filter((row) => row.targetType === "EMPLOYEE")
      .map((row) => row.userId)
      .filter((value): value is string => Boolean(value));
    const requestedPartnerIds = input.assignments
      .filter((row) => row.targetType === "PARTNER")
      .map((row) => row.partnerId)
      .filter((value): value is string => Boolean(value));

    const [eligibleUsers, eligiblePartners] = await Promise.all([
      requestedUserIds.length === 0
        ? Promise.resolve([])
        : prisma.user.findMany({
            where: {
              id: { in: requestedUserIds },
              status: UserStatus.ACTIVE,
              departmentId: input.departmentId,
              teamMemberships: {
                none: {
                  isPrimary: true,
                  startDate: { lte: monthEnd },
                  OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
                },
              },
            },
            select: { id: true },
          }),
      requestedPartnerIds.length === 0
        ? Promise.resolve([])
        : prisma.partner.findMany({
            where: {
              id: { in: requestedPartnerIds },
              status: "ACTIVE",
              OR: [
                { salesRateSetting: null },
                { salesRateSetting: { is: { remarks: null } } },
                { salesRateSetting: { is: { remarks: "" } } },
              ],
            },
            select: { id: true },
          }),
    ]);

    const eligibleUserIds = new Set(eligibleUsers.map((row) => row.id));
    const eligiblePartnerIds = new Set(eligiblePartners.map((row) => row.id));

    await prisma.$transaction(async (tx) => {
      await tx.departmentUnassignedMonthlyAssignment.deleteMany({
        where: { departmentId: input.departmentId, yearMonth: input.yearMonth },
      });

      const rows: Prisma.DepartmentUnassignedMonthlyAssignmentCreateManyInput[] = [];
      for (const row of input.assignments) {
        if (row.targetType === "EMPLOYEE") {
          if (!row.userId || !eligibleUserIds.has(row.userId)) continue;
          rows.push({
            targetType: AssignmentTargetType.EMPLOYEE,
            userId: row.userId,
            partnerId: null,
            departmentId: input.departmentId,
            yearMonth: input.yearMonth,
            unitPrice: row.unitPrice,
            salesAmount: normalizeSalesAmount(row.unitPrice, row.workRate),
            outsourcingCost: 0,
            workRate: row.workRate,
            remarks: row.remarks || null,
          });
          continue;
        }

        if (!row.partnerId || !eligiblePartnerIds.has(row.partnerId)) continue;
        rows.push({
          targetType: AssignmentTargetType.PARTNER,
          userId: null,
          partnerId: row.partnerId,
          departmentId: input.departmentId,
          yearMonth: input.yearMonth,
          unitPrice: row.unitPrice,
          salesAmount: normalizeSalesAmount(row.unitPrice, row.workRate),
          outsourcingCost: row.outsourcingCost,
          workRate: row.workRate,
          remarks: row.remarks || null,
        });
      }

      if (rows.length > 0) {
        await tx.departmentUnassignedMonthlyAssignment.createMany({ data: rows });
      }
    });

    return {
      persisted: true,
      bundle: await getDepartmentUnassignedSalesBundle(input.departmentId, input.yearMonth, { includeOptions: true }),
    };
  } catch (error) {
    console.error("Failed to save department unassigned sales", { input, error });
    return {
      persisted: false,
      bundle: await getDepartmentUnassignedSalesBundle(input.departmentId, input.yearMonth, { includeOptions: true }),
    };
  }
}
