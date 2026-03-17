import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSalaryRecordBundle, saveSalaryRecordBundle } from "@/lib/salary/salary-record-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const yearMonth = request.nextUrl.searchParams.get("yearMonth") ?? "2026-03";

  try {
    requirePermission(user, PERMISSIONS.salaryRead);
    const bundle = await getSalaryRecordBundle(yearMonth);
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load salary records" },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.salaryWrite);

    const body = (await request.json()) as {
      yearMonth?: string;
      rows?: Array<Record<string, unknown>>;
    };

    const result = await saveSalaryRecordBundle({
      yearMonth: String(body.yearMonth ?? "2026-03"),
      rows: (body.rows ?? []).map((row) => ({
        id: String(row.id ?? ""),
        userId: String(row.userId ?? ""),
        effectiveFrom: String(row.effectiveFrom ?? "2026-03-01"),
        baseSalary: toNumber(row.baseSalary),
        allowance: toNumber(row.allowance),
        socialInsurance: toNumber(row.socialInsurance),
        otherFixedCost: toNumber(row.otherFixedCost),
      })),
    });

    return NextResponse.json({
      message: result.source === "database" ? "社員コストを保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save salary records" },
      { status: 403 },
    );
  }
}

