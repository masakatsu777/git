import { getOrganizationBundle } from "@/lib/organization/organization-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type DepartmentMonthlyOtherCostRow = {
  id: string;
  departmentId: string;
  departmentName: string;
  amount: number;
  remarks: string;
};

export type DepartmentMonthlyOtherCostBundle = {
  yearMonth: string;
  rows: DepartmentMonthlyOtherCostRow[];
  departmentOptions: Array<{ departmentId: string; departmentName: string }>;
  source: "database" | "fallback";
};

export type SaveDepartmentMonthlyOtherCostInput = {
  yearMonth: string;
  rows: Array<{
    departmentId: string;
    amount: number;
    remarks: string;
  }>;
};

async function getDepartmentOptions() {
  const organization = await getOrganizationBundle();
  return organization.departments.map((department) => ({
    departmentId: department.id,
    departmentName: department.name,
  }));
}

function normalizeRows(rows: SaveDepartmentMonthlyOtherCostInput["rows"]) {
  return rows
    .map((row) => ({
      departmentId: row.departmentId.trim(),
      amount: Number.isFinite(row.amount) ? row.amount : 0,
      remarks: row.remarks.trim(),
    }))
    .filter((row) => row.departmentId && (row.amount !== 0 || row.remarks.length > 0));
}

export async function getDepartmentMonthlyOtherCostBundle(yearMonth: string): Promise<DepartmentMonthlyOtherCostBundle> {
  const departmentOptions = await getDepartmentOptions();

  if (!hasDatabaseUrl()) {
    return { yearMonth, rows: [], departmentOptions, source: "fallback" };
  }

  try {
    const rows = await prisma.departmentMonthlyOtherCost.findMany({
      where: { yearMonth },
      orderBy: [{ department: { name: "asc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        departmentId: true,
        amount: true,
        remarks: true,
        department: { select: { name: true } },
      },
    });

    return {
      yearMonth,
      departmentOptions,
      source: "database",
      rows: rows.map((row) => ({
        id: row.id,
        departmentId: row.departmentId,
        departmentName: row.department.name,
        amount: Number(row.amount),
        remarks: row.remarks ?? "",
      })),
    };
  } catch (error) {
    console.error("Failed to load department monthly other costs", { yearMonth, error });
    return { yearMonth, rows: [], departmentOptions, source: "fallback" };
  }
}

export async function saveDepartmentMonthlyOtherCostBundle(input: SaveDepartmentMonthlyOtherCostInput): Promise<DepartmentMonthlyOtherCostBundle> {
  const rows = normalizeRows(input.rows);
  const departmentOptions = await getDepartmentOptions();

  if (!hasDatabaseUrl()) {
    return {
      yearMonth: input.yearMonth,
      departmentOptions,
      source: "fallback",
      rows: rows.map((row, index) => ({
        id: `preview-${input.yearMonth}-${index + 1}`,
        departmentId: row.departmentId,
        departmentName: departmentOptions.find((option) => option.departmentId == row.departmentId)?.departmentName ?? row.departmentId,
        amount: row.amount,
        remarks: row.remarks,
      })),
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.departmentMonthlyOtherCost.deleteMany({ where: { yearMonth: input.yearMonth } });

      if (rows.length > 0) {
        await tx.departmentMonthlyOtherCost.createMany({
          data: rows.map((row) => ({
            departmentId: row.departmentId,
            yearMonth: input.yearMonth,
            amount: row.amount,
            remarks: row.remarks || null,
          })),
        });
      }
    });
  } catch (error) {
    console.error("Failed to save department monthly other costs", { input, error });
    return {
      yearMonth: input.yearMonth,
      departmentOptions,
      source: "fallback",
      rows: rows.map((row, index) => ({
        id: `preview-${input.yearMonth}-${index + 1}`,
        departmentId: row.departmentId,
        departmentName: departmentOptions.find((option) => option.departmentId == row.departmentId)?.departmentName ?? row.departmentId,
        amount: row.amount,
        remarks: row.remarks,
      })),
    };
  }

  return getDepartmentMonthlyOtherCostBundle(input.yearMonth);
}

export async function getDepartmentMonthlyOtherCostMap(yearMonths: string[]) {
  if (!hasDatabaseUrl() || yearMonths.length === 0) {
    return new Map<string, Map<string, number>>();
  }

  try {
    const rows = await prisma.departmentMonthlyOtherCost.findMany({
      where: { yearMonth: { in: yearMonths } },
      select: {
        departmentId: true,
        yearMonth: true,
        amount: true,
      },
    });

    const result = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const monthMap = result.get(row.yearMonth) ?? new Map<string, number>();
      monthMap.set(row.departmentId, (monthMap.get(row.departmentId) ?? 0) + Number(row.amount));
      result.set(row.yearMonth, monthMap);
    }
    return result;
  } catch (error) {
    console.error("Failed to load department monthly other cost map", { yearMonths, error });
    return new Map<string, Map<string, number>>();
  }
}
