import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getRateSettingsBundle, saveRateSettingsBundle } from "@/lib/rates/rate-setting-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const bundle = await getRateSettingsBundle();
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load rate settings" },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      employeeRates?: Array<Record<string, unknown>>;
      partnerRates?: Array<Record<string, unknown>>;
    };

    const result = await saveRateSettingsBundle({
      employeeRates: (body.employeeRates ?? []).map((row) => ({
        userId: String(row.userId ?? ""),
        employeeCode: String(row.employeeCode ?? ""),
        employeeName: String(row.employeeName ?? ""),
        teamName: String(row.teamName ?? ""),
        unitPrice: toNumber(row.unitPrice),
        defaultWorkRate: toNumber(row.defaultWorkRate),
        remarks: String(row.remarks ?? ""),
      })),
      partnerRates: (body.partnerRates ?? []).map((row) => ({
        partnerId: String(row.partnerId ?? ""),
        partnerName: String(row.partnerName ?? ""),
        companyName: String(row.companyName ?? ""),
        salesUnitPrice: toNumber(row.salesUnitPrice),
        defaultWorkRate: toNumber(row.defaultWorkRate),
        outsourceAmount: toNumber(row.outsourceAmount),
        salesRemarks: String(row.salesRemarks ?? ""),
        outsourceRemarks: String(row.outsourceRemarks ?? ""),
      })),
    });

    return NextResponse.json({
      message: result.source === "database" ? "単価・外注費基準値を保存しました" : "DB未接続のためプレビューのみ更新しました",
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save rate settings" },
      { status: 403 },
    );
  }
}
