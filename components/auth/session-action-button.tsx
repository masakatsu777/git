"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type SessionActionButtonProps = {
  mode: "login" | "logout";
  userId?: string;
  redirectTo?: string;
  className?: string;
  children: React.ReactNode;
};

export function SessionActionButton({
  mode,
  userId,
  redirectTo,
  className,
  children,
}: SessionActionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/logout";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, redirectTo }),
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { redirectTo?: string };

    startTransition(() => {
      router.push(payload.redirectTo ?? redirectTo ?? "/dashboard");
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={className}>
      {isPending ? "処理中..." : children}
    </button>
  );
}
