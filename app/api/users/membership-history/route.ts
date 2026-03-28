import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { writeAuditLog } from "@/lib/audit/log-service";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { deleteMembershipHistory, updateMembershipHistory } from "@/lib/users/user-management-service";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      membershipId?: string;
      startDate?: string;
      endDate?: string;
    };

    const membershipId = String(body.membershipId ?? "").trim();
    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();

    if (!membershipId || !startDate) {
      return NextResponse.json({ message: "所属履歴、所属開始日を指定してください。" }, { status: 400 });
    }

    const result = await updateMembershipHistory({ membershipId, startDate, endDate: endDate || undefined });

    await writeAuditLog({
      userId: user.id,
      action: "UPDATE_USER_MEMBERSHIP",
      resourceType: "team_membership",
      resourceId: membershipId,
      afterJson: { startDate, endDate, source: result.source },
    });

    return NextResponse.json({ message: "所属履歴を更新しました" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to update membership history" }, { status: 403 });
  }
}


export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      membershipId?: string;
    };

    const membershipId = String(body.membershipId ?? "").trim();
    if (!membershipId) {
      return NextResponse.json({ message: "削除対象の所属履歴を指定してください。" }, { status: 400 });
    }

    const result = await deleteMembershipHistory({ membershipId });

    await writeAuditLog({
      userId: user.id,
      action: "DELETE_USER_MEMBERSHIP",
      resourceType: "team_membership",
      resourceId: membershipId,
      afterJson: { source: result.source },
    });

    return NextResponse.json({ message: "所属履歴を削除しました" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to delete membership history" }, { status: 403 });
  }
}
