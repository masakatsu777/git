import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getDepartmentMonthlyOtherCostBundle, saveDepartmentMonthlyOtherCostBundle } from "@/lib/pl/department-monthly-other-cost-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "2026-03";

  try {
    if (user.role !== "admin" && user.role !== "president") {
      throw new Error("その他コストを表示する権限がありません");
    }
    const bundle = await getDepartmentMonthlyOtherCostBundle(yearMonth);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load department monthly other costs" },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    if (user.role !== "admin" && user.role !== "president") {
      throw new Error("その他コストを保存する権限がありません");
    }

    const body = (await request.json()) as {
      yearMonth?: string;
      rows?: Array<Record<string, unknown>>;
    };

    const result = await saveDepartmentMonthlyOtherCostBundle({
      yearMonth: String(body.yearMonth ?? "2026-03"),
      rows: (body.rows ?? []).map((row) => ({
        departmentId: String(row.departmentId ?? ""),
        amount: toNumber(row.amount),
        remarks: String(row.remarks ?? ""),
      })),
    });

    return NextResponse.json({
      message: result.source === "database" ? "その他コストを保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save department monthly other costs" },
      { status: 403 },
    );
  }
}
