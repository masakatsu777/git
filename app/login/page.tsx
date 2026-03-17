import Link from "next/link";

import { EmployeeCodeLoginForm } from "@/components/auth/employee-code-login-form";
import { SessionActionButton } from "@/components/auth/session-action-button";
import { SAMPLE_LOGIN_PASSWORD } from "@/lib/auth/password-constants";
import { getLoginUserOptions, getSessionUser } from "@/lib/auth/demo-session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const [users, currentUser, params] = await Promise.all([getLoginUserOptions(), getSessionUser(), searchParams]);
  const redirectTo = params.redirectTo?.trim() || undefined;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--color-brand-400)_18%,transparent),_transparent_36%),linear-gradient(180deg,#071321_0%,#020617_100%)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 px-8 py-8 shadow-[0_30px_80px_rgba(15,23,42,0.28)] backdrop-blur">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-200">Session Login</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">ログインユーザーを選択</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                社員コードとパスワードでログインできます。簡易確認用に、一覧からそのままユーザー選択ログインも残しています。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white">
                トップへ戻る
              </Link>
              <SessionActionButton
                mode="logout"
                redirectTo="/login"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white"
              >
                ログアウト
              </SessionActionButton>
            </div>
          </div>
          {redirectTo ? (
            <div className="mt-5 rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-100">
              ログイン後は <span className="font-semibold">{redirectTo}</span> へ戻ります。
            </div>
          ) : null}
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.5rem] bg-white/8 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-300">現在のセッション</p>
              <p className="mt-2 text-lg font-semibold">{currentUser.name}</p>
              <p className="mt-1 text-sm text-slate-300">
                ロール: {currentUser.role} / チーム: {currentUser.teamIds.join(", ") || "全社"}
              </p>
              <p className="mt-4 text-sm text-slate-300">
                seed直後の確認用パスワード: <span className="font-semibold text-white">{SAMPLE_LOGIN_PASSWORD}</span>
              </p>
            </div>
            <EmployeeCodeLoginForm redirectTo={redirectTo} />
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <article
              key={user.id}
              className="rounded-[1.75rem] border border-white/10 bg-white/6 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-brand-200">{user.role}</p>
              <h2 className="mt-3 text-2xl font-semibold">{user.name}</h2>
              <dl className="mt-4 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <dt>社員コード</dt>
                  <dd className="font-medium text-white">{user.employeeCode}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>所属</dt>
                  <dd className="text-right font-medium text-white">{user.teamName}</dd>
                </div>
              </dl>
              <SessionActionButton
                mode="login"
                userId={user.id}
                redirectTo={redirectTo || "/menu"}
                className="mt-6 w-full rounded-full bg-brand-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-brand-300"
              >
                このユーザーでログイン
              </SessionActionButton>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
