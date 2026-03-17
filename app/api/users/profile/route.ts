import { NextRequest, NextResponse } from "next/server";

import { UserStatus } from "@/generated/prisma";
import { getSessionUser } from "@/lib/auth/demo-session";
import { writeAuditLog } from "@/lib/audit/log-service";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { updateUserProfile } from "@/lib/users/user-management-service";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      rows?: Array<{
        userId?: string;
        name?: string;
        email?: string;
        roleId?: string;
        status?: string;
        departmentId?: string;
        teamId?: string;
        menuVisibility?: {
          philosophyPractice?: boolean;
          monthlyReport?: boolean;
          salaryStatement?: boolean;
          expenseSettlement?: boolean;
        };
      }>;
    };

    for (const row of body.rows ?? []) {
      const userId = String(row.userId ?? "");
      const name = String(row.name ?? "").trim();
      const email = String(row.email ?? "").trim();
      const roleId = String(row.roleId ?? "");
      const departmentId = String(row.departmentId ?? "");
      const teamId = String(row.teamId ?? "");
      const status = row.status === "INACTIVE" ? UserStatus.INACTIVE : UserStatus.ACTIVE;
      const menuVisibility = {
        philosophyPractice: row.menuVisibility?.philosophyPractice ?? true,
        monthlyReport: row.menuVisibility?.monthlyReport ?? false,
        salaryStatement: row.menuVisibility?.salaryStatement ?? false,
        expenseSettlement: row.menuVisibility?.expenseSettlement ?? false,
      };

      if (!userId || !name || !email || !roleId) {
        continue;
      }

      const effectiveTeamId = status === UserStatus.INACTIVE ? "" : teamId;
      const result = await updateUserProfile({ userId, name, email, roleId, status, departmentId, teamId: effectiveTeamId, menuVisibility });
      await writeAuditLog({
        userId: user.id,
        action: status === UserStatus.INACTIVE ? "RETIRE_USER" : "UPDATE_USER_PROFILE",
        resourceType: "user",
        resourceId: userId,
        afterJson: { name, email, roleId, status, departmentId, teamId: effectiveTeamId, menuVisibility, source: result.source },
      });
    }

    return NextResponse.json({ message: "ユーザー設定を更新しました" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to update user profile" }, { status: 403 });
  }
}
