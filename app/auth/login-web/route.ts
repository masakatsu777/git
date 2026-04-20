import { NextRequest, NextResponse } from "next/server";

import { resolveCredentialLoginTarget, resolveSelectedLoginTarget } from "@/lib/auth/demo-session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const userId = String(formData.get("userId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "").trim() || "/menu";

  const target = userId
    ? await resolveSelectedLoginTarget({ userId, redirectTo })
    : await resolveCredentialLoginTarget({ email, password, redirectTo });

  if (!target) {
    const failureUrl = new URL("/login", request.url);
    if (redirectTo) {
      failureUrl.searchParams.set("redirectTo", redirectTo);
    }
    failureUrl.searchParams.set("error", "1");
    return NextResponse.redirect(failureUrl);
  }

  const response = NextResponse.redirect(new URL(target.redirectTo, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, target.userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
