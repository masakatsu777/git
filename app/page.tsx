import Link from "next/link";

const features = [
  "Prisma/PostgreSQL を前提にした業務スキーマ",
  "評価・月次PL・昇給シミュレーションの設計を同梱",
  "RBAC とチームスコープを切り出した権限制御ユーティリティ",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--color-brand-400)_25%,transparent),_transparent_36%),linear-gradient(180deg,#06101f_0%,#020617_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
        <div className="max-w-4xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-brand-200">
            Engineering Evaluation Platform
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            評価制度とチーム収益管理を
            <span className="block text-brand-300">同じ基盤で運用するための土台。</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Prisma スキーマ、seed、権限制御ユーティリティ、ダッシュボードの初期画面をまとめて置いています。
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              ログイン
            </Link>
            <Link
              href="/executive"
              className="rounded-full bg-brand-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-brand-300"
            >
              トップ経営ダッシュボード
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30"
            >
              月次ダッシュボード
            </Link>
            <Link
              href="/api/me"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30"
            >
              セッションAPI確認
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <section
              key={feature}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <p className="text-sm leading-7 text-slate-200">{feature}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
