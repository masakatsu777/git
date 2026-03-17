"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "preflight-checklist-v1";

type ChecklistSection = {
  title: string;
  items: string[];
};

const sections: ChecklistSection[] = [
  {
    title: "環境準備",
    items: [
      ".env に DATABASE_URL が設定されている",
      "npx prisma generate が通る",
      "npx prisma migrate dev または npx prisma db push が通る",
      "npm run db:seed が必要なら投入済み",
      "npm run lint が通る",
      "npx tsc --noEmit が通る",
    ],
  },
  {
    title: "制度設定確認",
    items: [
      "評価制度設定の項目が最新化されている",
      "根拠必須と重みが意図通り設定されている",
      "総合等級別昇給ルールが設定されている",
      "期待充足ランク別昇給ルールが補助基準として設定されている",
      "給与構成の基準額と粗利補正が設定されている",
    ],
  },
  {
    title: "評価フロー確認",
    items: [
      "自己評価を保存できる",
      "上長評価を保存できる",
      "最終評価で達成率、実施率、総合等級、期待充足ランクが表示される",
    ],
  },
  {
    title: "昇給シミュレーション確認",
    items: [
      "新月額(参考) が給与構成と粗利補正から計算される",
      "決定額を入力すると昇給率と昇給額が逆算される",
      "差額が大きい行で調整理由が必須になる",
      "保存、承認、反映まで実行できる",
    ],
  },
  {
    title: "結果と監査確認",
    items: [
      "昇給結果一覧で参考額、決定額、差額、理由、状態を確認できる",
      "個人詳細で評価と昇給決定をまとめて確認できる",
      "監査ログに保存、承認、反映の記録が残る",
    ],
  },
  {
    title: "運用認識",
    items: [
      "期待充足ランクを役割期待充足の補助指標として説明できる",
      "B は低評価ではなく、現在の役割期待を安定して満たしている状態という認識が揃っている",
      "総合等級を主基準、期待充足ランクを補助基準として運用する認識が揃っている",
      "調整理由をどの水準で書くかの運用ルールがある",
    ],
  },
];

function makeKey(sectionTitle: string, item: string) {
  return `${sectionTitle}::${item}`;
}

function loadInitialCheckedMap(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function PreflightChecklist() {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(loadInitialCheckedMap);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedMap));
    } catch {
      // ignore storage failures
    }
  }, [checkedMap]);

  const counts = useMemo(() => {
    const total = sections.reduce((sum, section) => sum + section.items.length, 0);
    const completed = sections.reduce(
      (sum, section) => sum + section.items.filter((item) => checkedMap[makeKey(section.title, item)]).length,
      0,
    );
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [checkedMap]);

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">本番前チェックリスト</h2>
          <p className="mt-2 text-sm text-slate-600">アプリ内で確認しながら進められる最終チェックです。チェック状態はこのブラウザに保存されます。</p>
        </div>
        <div className="min-w-[220px] rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-sm text-slate-500">進捗</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{counts.completed} / {counts.total}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-slate-950" style={{ width: `${counts.percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">{counts.percent}% 完了</p>
        </div>
      </div>

      <div className="space-y-5">
        {sections.map((section) => {
          const completed = section.items.filter((item) => checkedMap[makeKey(section.title, item)]).length;
          return (
            <section key={section.title} className="rounded-3xl border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{section.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{completed} / {section.items.length} 完了</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...checkedMap };
                    for (const item of section.items) {
                      next[makeKey(section.title, item)] = true;
                    }
                    setCheckedMap(next);
                  }}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  この章を完了にする
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {section.items.map((item) => {
                  const key = makeKey(section.title, item);
                  return (
                    <label key={key} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(checkedMap[key])}
                        onChange={(event) => setCheckedMap((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                      <span>{item}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
