import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isLoginUserIdValid } from "@/lib/auth/demo-session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionUserId && await isLoginUserIdValid(sessionUserId)) {
    redirect("/menu");
  }

  redirect("/login");
}
