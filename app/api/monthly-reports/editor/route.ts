import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getMonthlyReportEditorBundle } from "@/lib/monthly-reports/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const bundle = await getMonthlyReportEditorBundle(user, {
      yearMonth: request.nextUrl.searchParams.get("yearMonth") ?? "",
      projectId: request.nextUrl.searchParams.get("projectId") ?? "",
    });

    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load editor bundle" },
      { status: 400 },
    );
  }
}
