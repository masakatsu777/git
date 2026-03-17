"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type EmployeeCodeLoginFormProps = {
  redirectTo?: string;
};

export function EmployeeCodeLoginForm({ redirectTo }: EmployeeCodeLoginFormProps) {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ employeeCode, password, redirectTo }),
    });

    const payload = (await response.json().catch(() => null)) as { message?: string; redirectTo?: string } | null;

    if (!response.ok) {
      setErrorMessage(payload?.message ?? "ログインに失敗しました。");
      return;
    }

    startTransition(() => {
      router.push(payload?.redirectTo ?? redirectTo ?? "/menu");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[1.5rem] bg-white/8 p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-300">社員コードログイン</p>
      <label className="mt-4 block text-sm text-slate-200">
        社員コード
        <input
          type="text"
          value={employeeCode}
          onChange={(event) => setEmployeeCode(event.target.value)}
          placeholder="例: E1002"
          className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
        />
      </label>
      <label className="mt-4 block text-sm text-slate-200">
        パスワード
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="パスワード"
          className="mt-2 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none"
        />
      </label>
      {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "ログイン中..." : "社員コードでログイン"}
      </button>
    </form>
  );
}
