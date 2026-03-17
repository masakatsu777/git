import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/demo-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { redirectTo?: string } | null;
  const response = NextResponse.json({
    ok: true,
    redirectTo: body?.redirectTo || "/login",
  });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
