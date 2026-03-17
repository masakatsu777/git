import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, resolveCredentialLoginTarget, resolveSelectedLoginTarget } from "@/lib/auth/demo-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    employeeCode?: string;
    password?: string;
    redirectTo?: string;
  } | null;

  const target = body?.userId
    ? await resolveSelectedLoginTarget({ userId: body.userId, redirectTo: body.redirectTo })
    : await resolveCredentialLoginTarget({ employeeCode: body?.employeeCode, password: body?.password, redirectTo: body?.redirectTo });

  if (!target) {
    return NextResponse.json({ message: "社員コードまたはパスワードが正しくありません。" }, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: target.redirectTo,
  });

  response.cookies.set(SESSION_COOKIE_NAME, target.userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
