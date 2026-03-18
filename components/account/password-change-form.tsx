"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PasswordChangeFormProps = {
  userName: string;
};

export function PasswordChangeForm({ userName }: PasswordChangeFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("現在のパスワード、新しいパスワード、確認入力をすべて入力してください。");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("新しいパスワードと確認入力が一致していません。");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setMessage(payload?.message ?? (response.ok ? "パスワードを変更しました。" : "パスワード変更に失敗しました。"));

      if (response.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Password</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">パスワード変更</h2>
          <p className="mt-2 text-sm text-slate-600">{userName} さん自身のログインパスワードを変更できます。</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 lg:grid-cols-3">
        <label className="text-sm text-slate-700">
          現在のパスワード
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
          />
        </label>
        <label className="text-sm text-slate-700">
          新しいパスワード
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
          />
        </label>
        <label className="text-sm text-slate-700">
          新しいパスワード確認
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-4 lg:col-span-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "変更中..." : "パスワードを変更"}
          </button>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </form>
    </section>
  );
}
