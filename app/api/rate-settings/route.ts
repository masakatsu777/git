import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getRateSettingsBundle, saveRateSettingsBundle, canManageRateSettings } from "@/lib/rates/rate-setting-service";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const user = await getSessionUser();

  try {
    if (!canManageRateSettings(user)) {
      throw new Error("この画面を表示する権限がありません。");
    }

    const bundle = await getRateSettingsBundle(user);
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
    if (!canManageRateSettings(user)) {
      throw new Error("この画面を更新する権限がありません。");
    }

    const body = (await request.json()) as {
      employeeRates?: Array<Record<string, unknown>>;
      partnerRates?: Array<Record<string, unknown>>;
      deletedPartnerIds?: unknown[];
    };

    const result = await saveRateSettingsBundle({
      employeeRates: (body.employeeRates ?? []).map((row) => ({
        userId: String(row.userId ?? ""),
        employeeCode: String(row.employeeCode ?? ""),
        employeeName: String(row.employeeName ?? ""),
        teamId: String(row.teamId ?? ""),
        teamName: String(row.teamName ?? ""),
        unitPrice: toNumber(row.unitPrice),
        defaultWorkRate: toNumber(row.defaultWorkRate),
        remarks: String(row.remarks ?? ""),
      })),
      partnerRates: (body.partnerRates ?? []).map((row) => ({
        partnerId: String(row.partnerId ?? ""),
        partnerName: String(row.partnerName ?? ""),
        jurisdictionTeamId: String(row.jurisdictionTeamId ?? ""),
        jurisdictionTeamName: String(row.jurisdictionTeamName ?? ""),
        salesUnitPrice: toNumber(row.salesUnitPrice),
        defaultWorkRate: toNumber(row.defaultWorkRate),
        outsourceAmount: toNumber(row.outsourceAmount),
        affiliation: String(row.affiliation ?? ""),
        note: String(row.note ?? ""),
      })),
      deletedPartnerIds: (body.deletedPartnerIds ?? []).map((value) => String(value ?? "")).filter(Boolean),
    }, user);

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
