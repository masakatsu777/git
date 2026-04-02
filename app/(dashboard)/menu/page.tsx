import Link from "next/link";

import { MobileInstallBanner } from "@/components/mobile-install-banner";
import { getSessionUser } from "@/lib/auth/demo-session";
import type { UserMenuVisibility } from "@/lib/menu-visibility/menu-visibility-service";
import { getUserMenuVisibility } from "@/lib/menu-visibility/menu-visibility-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

type MenuCard = {
  title: string;
  description: string;
  href?: string;
  status?: string;
};

function buildCards(role: string, visibility: UserMenuVisibility, canManageUsers: boolean): MenuCard[] {
  const evaluationTarget = role === "employee" ? "/evaluations/my" : "/dashboard";
  const cards: MenuCard[] = [];

  if (visibility.philosophyPractice) {
    cards.push({
      title: "理念実践ナビ",
      description: `自律的成長によって必要とされる存在となり、協調相乗をもって他者貢献に尽くす。
この理念の実践を自他で確認します。`,
      href: evaluationTarget,
    });
  }

  if (visibility.monthlyReport) {
    cards.push({
      title: "月報作成",
      description: "将来的に月報入力や提出フローを追加するためのメニューです。",
      status: "準備中",
    });
  }

  if (visibility.salaryStatement) {
    cards.push({
      title: "給与明細",
      description: "将来的に給与明細の確認や配布機能を追加するためのメニューです。",
      status: "準備中",
    });
  }

  if (visibility.expenseSettlement) {
    cards.push({
      title: "経費精算",
      description: "将来的に経費申請や承認フローを追加するためのメニューです。",
      status: "準備中",
    });
  }

  cards.push({
    title: "パスワード変更",
    description: "ご自身のログインパスワードを変更します。",
    href: "/account/password",
  });

  if (canManageUsers) {
    cards.push({
      title: "ユーザー管理",
      description: "ユーザーの所属、ロール、メニュー表示対象を個別に管理します。",
      href: "/settings/users",
    });
  }

  return cards;
}

export default async function MenuPage() {
  const user = await getSessionUser();
  const visibility = await getUserMenuVisibility(user.id, user.role);
  const canManageUsers = hasPermission(user, PERMISSIONS.masterWrite);
  const cards = buildCards(user.role, visibility, canManageUsers);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Main Menu</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">GIT Members メニュー</h1>
              <p className="mt-2 text-sm text-slate-300">
                ログイン後の入口です。ここから各業務メニューへ進めます。
              </p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              {user.name} / {user.role}
            </div>
          </div>
        </header>

        <MobileInstallBanner />

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          {cards.length === 0 ? (
            <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <h2 className="text-2xl font-semibold text-slate-950">利用できるメニューがありません</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">現在表示対象のメニューが設定されていません。必要に応じて管理者へご相談ください。</p>
            </article>
          ) : cards.map((card) => (
            <article
              key={card.title}
              className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">{card.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
                </div>
                {card.status ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {card.status}
                  </span>
                ) : null}
              </div>
              <div className="mt-6">
                {card.href ? (
                  <Link
                    href={card.href}
                    className="inline-flex rounded-full bg-brand-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-brand-300"
                  >
                    {card.title}へ進む
                  </Link>
                ) : (
                  <span className="inline-flex rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500">
                    近日追加予定
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
