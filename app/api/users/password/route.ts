import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { writeAuditLog } from "@/lib/audit/log-service";
import { updateUserPassword } from "@/lib/users/user-management-service";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as { userId?: string; password?: string };
    const userId = String(body.userId ?? "");
    const password = String(body.password ?? "");

    if (!userId || !password) {
      return NextResponse.json({ message: "対象ユーザーとパスワードを入力してください。" }, { status: 400 });
    }

    const result = await updateUserPassword({ userId, password });
    await writeAuditLog({
      userId: user.id,
      action: "UPDATE_USER_PASSWORD",
      resourceType: "user",
      resourceId: userId,
      afterJson: { source: result.source },
    });

    return NextResponse.json({
      message: result.source === "database" ? "パスワードを更新しました" : "DB未接続のためプレビューのみ更新しました",
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to update password" }, { status: 403 });
  }
}
