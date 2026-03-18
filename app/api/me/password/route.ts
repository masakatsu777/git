import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { writeAuditLog } from "@/lib/audit/log-service";
import { changeOwnPassword } from "@/lib/users/user-management-service";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
  } | null;

  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: "現在のパスワードと新しいパスワードを入力してください。" }, { status: 400 });
  }

  try {
    const result = await changeOwnPassword({
      userId: user.id,
      currentPassword,
      newPassword,
    });

    await writeAuditLog({
      userId: user.id,
      action: "SELF_UPDATE_PASSWORD",
      resourceType: "user",
      resourceId: user.id,
      afterJson: { source: result.source },
    });

    return NextResponse.json({
      message: result.source === "database" ? "パスワードを変更しました。" : "DB未接続のためプレビューのみ更新しました。",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update password" },
      { status: 400 },
    );
  }
}
