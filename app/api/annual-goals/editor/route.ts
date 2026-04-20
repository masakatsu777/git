import { NextRequest, NextResponse } from "next/server";

import { getAnnualGoalEditorBundle } from "@/lib/annual-goals/service";
import { getSessionUser } from "@/lib/auth/demo-session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  try {
    const bundle = await getAnnualGoalEditorBundle(user, {
      fiscalYear: request.nextUrl.searchParams.get("fiscalYear") ?? "",
      evaluationPeriodId: request.nextUrl.searchParams.get("evaluationPeriodId") ?? "",
    });

    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load annual goal editor bundle" },
      { status: 400 },
    );
  }
}
