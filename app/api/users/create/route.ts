import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { writeAuditLog } from "@/lib/audit/log-service";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { createUser } from "@/lib/users/user-management-service";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      employeeCode?: string;
      name?: string;
      email?: string;
      roleId?: string;
      departmentId?: string;
      teamId?: string;
      password?: string;
    };

    const employeeCode = String(body.employeeCode ?? "").trim();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const roleId = String(body.roleId ?? "").trim();
    const departmentId = String(body.departmentId ?? "").trim();
    const teamId = String(body.teamId ?? "").trim();
    const password = String(body.password ?? "");

    if (!employeeCode || !name || !email || !roleId || !password) {
      return NextResponse.json({ message: "社員コード、氏名、メール、ロール、初期パスワードを入力してください。" }, { status: 400 });
    }

    const result = await createUser({ employeeCode, name, email, roleId, departmentId, teamId, password });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE_USER",
      resourceType: "user",
      resourceId: result.userId,
      afterJson: { employeeCode, name, email, roleId, departmentId, teamId, source: result.source },
    });

    return NextResponse.json({
      message: result.source === "database" ? "ユーザーを作成しました" : "DB未接続のためプレビューのみ作成しました",
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to create user" }, { status: 403 });
  }
}
