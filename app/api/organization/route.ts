import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getOrganizationBundle, saveOrganizationStructure } from "@/lib/organization/organization-service";

export async function GET() {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const bundle = await getOrganizationBundle();
    return NextResponse.json({ data: bundle });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to load organization" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  try {
    requirePermission(user, PERMISSIONS.masterWrite);
    const body = (await request.json()) as {
      departments?: Array<{ id?: string; name?: string }>;
      teams?: Array<{ id?: string; name?: string; departmentId?: string; leaderUserId?: string; isActive?: boolean }>;
    };

    const result = await saveOrganizationStructure({
      departments: (body.departments ?? []).map((department) => ({
        id: department.id ? String(department.id) : undefined,
        name: String(department.name ?? ""),
      })),
      teams: (body.teams ?? []).map((team) => ({
        id: team.id ? String(team.id) : undefined,
        name: String(team.name ?? ""),
        departmentId: team.departmentId ? String(team.departmentId) : undefined,
        leaderUserId: team.leaderUserId ? String(team.leaderUserId) : undefined,
        isActive: Boolean(team.isActive),
      })),
    });

    return NextResponse.json({
      message: result.source === "database" ? "組織構成を保存しました" : "DB未接続のためプレビューのみ更新しました",
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to save organization" }, { status: 403 });
  }
}
