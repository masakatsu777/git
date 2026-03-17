import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { writeAuditLog } from "@/lib/audit/log-service";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { assignUserToTeam } from "@/lib/users/user-management-service";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      userId?: string;
      teamId?: string;
    };

    const userId = String(body.userId ?? "").trim();
    const teamId = String(body.teamId ?? "").trim();

    if (!userId || !teamId) {
      return NextResponse.json({ message: "対象ユーザーとチームを指定してください" }, { status: 400 });
    }

    const result = await assignUserToTeam({ userId, teamId });
    await writeAuditLog({
      userId: user.id,
      action: "ASSIGN_USER_TEAM",
      resourceType: "user",
      resourceId: userId,
      afterJson: { teamId, source: result.source },
    });

    return NextResponse.json({ message: "チーム所属を更新しました" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to assign team" }, { status: 403 });
  }
}
