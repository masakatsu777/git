import { NextResponse } from "next/server";
import { getSalaryStructureBundle, saveSalaryStructureBundle } from "@/lib/salary-structure/salary-structure-service";

export async function GET() {
  const bundle = await getSalaryStructureBundle();
  return NextResponse.json(bundle);
}

export async function POST(request: Request) {
  const body = await request.json();
  const bundle = await saveSalaryStructureBundle(body);

  return NextResponse.json({
    message: "給与構成設定を保存しました。",
    bundle,
  });
}
