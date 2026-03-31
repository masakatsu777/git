import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getDepartmentUnassignedSalesBundle, saveDepartmentUnassignedSales } from "@/lib/pl/department-unassigned-sales-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureAuthorized(role: string) {
  if (role !== "admin" && role !== "president") {
    throw new Error("未所属売上の操作権限がありません");
  }
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  try {
    ensureAuthorized(user.role);
    const departmentId = request.nextUrl.searchParams.get("departmentId") ?? "";
    const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? undefined;
    const bundle = await getDepartmentUnassignedSalesBundle(departmentId, yearMonth, { includeOptions: true });
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to load unassigned sales" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    ensureAuthorized(user.role);
    const body = (await request.json()) as Record<string, unknown>;
    const result = await saveDepartmentUnassignedSales({
      departmentId: String(body.departmentId ?? ""),
      yearMonth: String(body.yearMonth ?? ""),
      assignments: Array.isArray(body.assignments)
        ? body.assignments.map((row) => {
            const item = row as Record<string, unknown>;
            return {
              targetType: item.targetType === "PARTNER" ? "PARTNER" : "EMPLOYEE",
              userId: typeof item.userId === "string" ? item.userId : null,
              partnerId: typeof item.partnerId === "string" ? item.partnerId : null,
              partnerName: String(item.partnerName ?? ""),
              unitPrice: toNumber(item.unitPrice),
              salesAmount: toNumber(item.salesAmount),
              workRate: toNumber(item.workRate),
              remarks: String(item.remarks ?? ""),
            };
          })
        : [],
    });

    return NextResponse.json({
      message: result.persisted ? "未所属売上を保存しました" : "DB未接続のため未所属売上はプレビューのみです",
      persisted: result.persisted,
      data: result.bundle,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to save unassigned sales" }, { status: 403 });
  }
}
