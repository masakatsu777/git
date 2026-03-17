import { NextResponse } from "next/server";
import { saveUiSettings } from "@/lib/ui-settings";
import { getCurrentViewer } from "@/lib/viewer-context";

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();

  if (viewer.role !== "admin") {
    return NextResponse.json({ message: "管理者のみ保存できます。" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, string>;
  const settings = await saveUiSettings(body);

  return NextResponse.json({ settings });
}
