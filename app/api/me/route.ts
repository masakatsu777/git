import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getRolePermissions } from "@/lib/permissions/check";

export async function GET() {
  const user = await getSessionUser();

  return NextResponse.json({
    user,
    permissions: getRolePermissions(user.role),
  });
}