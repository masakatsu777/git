import Link from "next/link";

import { SalaryRevisionRuleEditor } from "@/components/settings/salary-revision-rule-editor";
import { getSessionUser } from "@/lib/auth/demo-session";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";
import { getSalaryRevisionRuleBundle } from "@/lib/salary-rules/salary-revision-rule-service";

export default async function SalaryRevisionRulesPage() {
  const user = await getSessionUser();
  const canView = hasPermission(user, PERMISSIONS.masterWrite);

  if (!canView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold text-slate-950">期待充足ランク別昇給ルール</h1>
            <p className="mt-3 text-sm text-slate-600">この画面を表示する権限がありません。</p>
            <div className="mt-6">
              <Link href="/dashboard" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                ダッシュボードへ戻る
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const bundle = await getSalaryRevisionRuleBundle();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Rating Salary Rules</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">期待充足ランク別昇給ルール</h1>
              <p className="mt-2 text-sm text-slate-300">期待充足ランク S〜D ごとの昇給率レンジを管理します。期待充足ランクは現在の役割期待に対する充足度を見る補助基準で、総合等級ルールが未設定のときに使います。B は低評価ではなく、現在の役割期待を安定して満たしている状態として扱います。</p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                ダッシュボードへ
              </Link>
              <Link href="/salary/simulations" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium">
                昇給シミュレーションへ
              </Link>
            </div>
          </div>
        </header>


        <section className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-slate-950">昇給ルールの使われ方</h2>
          <p className="mt-1 text-sm text-slate-500">昇給シミュレーションでは、次の順でルールを参照します。</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">1</p>
              <p className="mt-2 font-semibold text-slate-950">総合等級別昇給ルール</p>
              <p className="mt-1 text-sm text-slate-600">主基準として最優先で使います。</p>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">2</p>
              <p className="mt-2 font-semibold text-slate-950">期待充足ランク別昇給ルール</p>
              <p className="mt-1 text-sm text-slate-600">総合等級ルールが未設定のときの補助基準として使います。</p>
            </article>
            <article className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">3</p>
              <p className="mt-2 font-semibold text-slate-950">個別調整</p>
              <p className="mt-1 text-sm text-slate-600">最終的な昇給案は、シミュレーション上で個別に調整できます。</p>
            </article>
          </div>
        </section>

        <div className="mt-8">
          <SalaryRevisionRuleEditor
            canEdit={canView}
            defaults={bundle}
            title="期待充足ランク別昇給ルール"
            description="期待充足ランクごとの下限、上限、標準昇給率を設定します。期待充足ランクは現在の役割期待に対する充足度を見る補助基準で、総合等級ルールが未設定のときに使います。B は低評価ではなく、現在の役割期待を安定して満たしている状態として扱います。"
            ruleLabel="期待充足ランク"
            saveLabel="期待充足ランク別昇給ルールを保存"
          />
        </div>
      </div>
    </main>
  );
}
