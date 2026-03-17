"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UiSettings } from "@/lib/ui-settings";

type SettingsFormProps = Readonly<{
  initialSettings: UiSettings;
  canEdit: boolean;
}>;

export function SettingsForm({ initialSettings, canEdit }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState("");
  const [formValues, setFormValues] = useState(initialSettings);

  function updateField<Key extends keyof UiSettings>(key: Key, value: UiSettings[Key]) {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetForm() {
    setFormValues(initialSettings);
    setStatusMessage("保存済みの内容に戻しました。");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setStatusMessage("この preview role では保存できません。管理者に切り替えてください。");
      return;
    }

    setStatusMessage("");

    const response = await fetch("/api/ui-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formValues),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setStatusMessage(payload?.message ?? "保存に失敗しました。");
      return;
    }

    setStatusMessage("設定を保存しました。画面表示を更新します。");
    startTransition(() => {
      router.refresh();
    });
  }

  const previewCards = [
    {
      title: "社員プレビュー",
      description: `${formValues.employeeNavLabel}、自分の${formValues.growthRecordsLabel}、1on1準備を中心に表示`,
    },
    {
      title: "リーダープレビュー",
      description: `${formValues.leaderNavLabel}、チームの${formValues.growthRecordsLabel}、${formValues.oneOnOneLabel}を中心に表示`,
    },
    {
      title: "管理者プレビュー",
      description: `${formValues.adminNavLabel}、全体俯瞰、運用改善を中心に表示`,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={handleSubmit} className="space-y-6">
        <article className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">表示名称の調整</h2>
          <div className="mt-5 space-y-4">
            <label className="block rounded-3xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-slate-300">社員向け一覧名称</span>
              <input
                value={formValues.employeeNavLabel}
                onChange={(event) => updateField("employeeNavLabel", event.target.value)}
                disabled={!canEdit || isPending}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
              <span className="mt-2 block text-xs text-slate-400">社員本人に見せるときのナビゲーション名称です。</span>
            </label>

            <label className="block rounded-3xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-slate-300">リーダー向け一覧名称</span>
              <input
                value={formValues.leaderNavLabel}
                onChange={(event) => updateField("leaderNavLabel", event.target.value)}
                disabled={!canEdit || isPending}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
              <span className="mt-2 block text-xs text-slate-400">チーム支援の入口として見せる名称です。</span>
            </label>

            <label className="block rounded-3xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-slate-300">管理者向け一覧名称</span>
              <input
                value={formValues.adminNavLabel}
                onChange={(event) => updateField("adminNavLabel", event.target.value)}
                disabled={!canEdit || isPending}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
              <span className="mt-2 block text-xs text-slate-400">全体を俯瞰するための名称です。</span>
            </label>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">テンプレート文言の管理</h2>
          <div className="mt-5 space-y-4">
            <label className="block rounded-3xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-slate-300">成長記録の見出し</span>
              <textarea
                value={formValues.growthRecordsLabel}
                onChange={(event) => updateField("growthRecordsLabel", event.target.value)}
                rows={2}
                disabled={!canEdit || isPending}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>

            <label className="block rounded-3xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-slate-300">1on1 画面の見出し</span>
              <textarea
                value={formValues.oneOnOneLabel}
                onChange={(event) => updateField("oneOnOneLabel", event.target.value)}
                rows={2}
                disabled={!canEdit || isPending}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>

            <label className="block rounded-3xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-slate-300">ホームの主メッセージ</span>
              <textarea
                value={formValues.homeMessage}
                onChange={(event) => updateField("homeMessage", event.target.value)}
                rows={2}
                disabled={!canEdit || isPending}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>
          </div>
        </article>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={!canEdit || isPending}
            className="rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "更新中..." : "設定を保存"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={isPending}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            保存済みに戻す
          </button>
          <p className="text-sm text-slate-300">{statusMessage}</p>
        </div>
      </form>

      <section className="space-y-6">
        <article className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">live preview</h2>
          <div className="mt-5 space-y-4">
            {previewCards.map((card) => (
              <div key={card.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{card.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{card.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">現在編集中の値</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <p>社員向け名称: {formValues.employeeNavLabel}</p>
            <p>リーダー向け名称: {formValues.leaderNavLabel}</p>
            <p>管理者向け名称: {formValues.adminNavLabel}</p>
            <p>成長記録名称: {formValues.growthRecordsLabel}</p>
            <p>1on1名称: {formValues.oneOnOneLabel}</p>
            <p>ホーム文言: {formValues.homeMessage}</p>
          </div>
        </article>
      </section>
    </div>
  );
}
