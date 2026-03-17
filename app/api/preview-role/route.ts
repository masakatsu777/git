import { NextRequest, NextResponse } from "next/server";

const allowedRoles = new Set(["employee", "leader", "admin"]);

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") ?? "employee";
  const redirectTo = request.nextUrl.searchParams.get("redirectTo") ?? "/employees";

  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  if (allowedRoles.has(role)) {
    response.cookies.set("preview-role", role, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
  }

  return response;
}
