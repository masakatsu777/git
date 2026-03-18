import Link from "next/link";

import { PasswordChangeForm } from "@/components/account/password-change-form";
import { getSessionUser } from "@/lib/auth/demo-session";

export default async function AccountPasswordPage() {
  const user = await getSessionUser();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Account</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">アカウント設定</h1>
              <p className="mt-2 text-sm text-slate-300">ログインに使うご自身のパスワードを変更します。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/menu" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white">
                メニューへ戻る
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <PasswordChangeForm userName={user.name} />
        </div>
      </div>
    </main>
  );
}
