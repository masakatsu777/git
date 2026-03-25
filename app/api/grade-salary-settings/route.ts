import { NextResponse } from "next/server";

import { getGradeSalarySettingBundle, saveGradeSalarySettingBundle } from "@/lib/grade-salary/grade-salary-setting-service";

export async function GET() {
  const bundle = await getGradeSalarySettingBundle();
  return NextResponse.json(bundle);
}

export async function POST(request: Request) {
  const body = await request.json();
  const bundle = await saveGradeSalarySettingBundle(body);

  return NextResponse.json({
    message: "等級・給与計算設定を保存しました。",
    bundle,
  });
}
