"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  MonthlyReportEditorBundle,
  PersonalReportFields,
  TeamReportFields,
} from "@/lib/monthly-reports/service";

type MonthlyReportFormProps = {
  initialBundle: MonthlyReportEditorBundle;
};

function createEmptyTeamReport(): TeamReportFields {
  return {
    projectSummary: "",
    teamSelfGrowthIssue: "",
    teamSelfGrowthResult: "",
    teamSelfGrowthNextIssue: "",
    teamSynergyIssue: "",
    teamSynergyResult: "",
    teamSynergyNextIssue: "",
  };
}

function createEmptyPersonalReport(): PersonalReportFields {
  return {
    projectRole: "",
    personalSelfGrowthIssue: "",
    personalSelfGrowthResult: "",
    personalSelfGrowthNextIssue: "",
    personalSynergyIssue: "",
    personalSynergyResult: "",
    personalSynergyNextIssue: "",
  };
}

function readValue(value?: string | null) {
  return value ?? "";
}

function preferNextIssue(nextIssue: string, currentIssue: string) {
  return readValue(nextIssue).trim() || readValue(currentIssue).trim();
}

function showAnnualGoalOnTeamSection(bundle: MonthlyReportEditorBundle) {
  return Boolean(bundle.annualGoalReference && bundle.annualGoalReference.goalType === "team");
}

function showAnnualGoalOnPersonalSection(bundle: MonthlyReportEditorBundle) {
  return Boolean(bundle.annualGoalReference && bundle.annualGoalReference.goalType === "personal");
}

export function MonthlyReportForm({ initialBundle }: MonthlyReportFormProps) {
  const router = useRouter();
  const [bundle, setBundle] = useState(initialBundle);
  const [yearMonth, setYearMonth] = useState(initialBundle.currentYearMonth);
  const [selectedProjectId, setSelectedProjectId] = useState(initialBundle.selectedProjectId);
  const [newProjectName, setNewProjectName] = useState("");
  const [teamReport, setTeamReport] = useState<TeamReportFields>(initialBundle.teamReport ?? createEmptyTeamReport());
  const [personalReport, setPersonalReport] = useState<PersonalReportFields>(initialBundle.personalReport);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentProject = useMemo(
    () => bundle.projectOptions.find((project) => project.projectId === selectedProjectId) ?? null,
    [bundle.projectOptions, selectedProjectId],
  );
  const showTeamSection = Boolean(currentProject?.teamId ?? bundle.viewer.teamId);

  async function reloadEditor(nextYearMonth: string, nextProjectId: string) {
    const params = new URLSearchParams();
    params.set("yearMonth", nextYearMonth);
    if (nextProjectId) {
      params.set("projectId", nextProjectId);
    }

    const response = await fetch(`/api/monthly-reports/editor?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as MonthlyReportEditorBundle & { message?: string };

    if (!response.ok) {
      setMessage(payload.message ?? "月報データの読み込みに失敗しました。");
      return;
    }

    setBundle(payload);
    setTeamReport(payload.teamReport ?? createEmptyTeamReport());
    setPersonalReport(payload.personalReport ?? createEmptyPersonalReport());
  }

  async function copyFromPreviousMonth(target: "team" | "personal") {
    setMessage(null);

    if (!selectedProjectId) {
      setMessage("前月コピーを行うには、先にプロジェクトを選択してください。");
      return;
    }

    startTransition(async () => {
      const params = new URLSearchParams();
      params.set("yearMonth", bundle.previousYearMonth);
      params.set("projectId", selectedProjectId);

      const response = await fetch(`/api/monthly-reports/editor?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as (MonthlyReportEditorBundle & { message?: string }) | null;

      if (!response.ok || !payload) {
        setMessage(payload?.message ?? "前月データの読み込みに失敗しました。");
        return;
      }

      if (target === "team") {
        if (!payload.teamReport) {
          setMessage(`${bundle.previousYearMonth} のチーム月報はありません。`);
          return;
        }
        setTeamReport({
          projectSummary: payload.teamReport.projectSummary,
          teamSelfGrowthIssue: preferNextIssue(payload.teamReport.teamSelfGrowthNextIssue, payload.teamReport.teamSelfGrowthIssue),
          teamSelfGrowthResult: "",
          teamSelfGrowthNextIssue: "",
          teamSynergyIssue: preferNextIssue(payload.teamReport.teamSynergyNextIssue, payload.teamReport.teamSynergyIssue),
          teamSynergyResult: "",
          teamSynergyNextIssue: "",
        });
        setMessage(`${bundle.previousYearMonth} の次月課題を当月課題へコピーしました。保存すると反映されます。`);
        return;
      }

      const hasAnyPersonalValue = Object.values(payload.personalReport ?? {}).some((value) => value.trim() !== "");
      if (!hasAnyPersonalValue) {
        setMessage(`${bundle.previousYearMonth} の個人月報はありません。`);
        return;
      }

      setPersonalReport({
        projectRole: payload.personalReport.projectRole,
        personalSelfGrowthIssue: preferNextIssue(payload.personalReport.personalSelfGrowthNextIssue, payload.personalReport.personalSelfGrowthIssue),
        personalSelfGrowthResult: "",
        personalSelfGrowthNextIssue: "",
        personalSynergyIssue: preferNextIssue(payload.personalReport.personalSynergyNextIssue, payload.personalReport.personalSynergyIssue),
        personalSynergyResult: "",
        personalSynergyNextIssue: "",
      });
      setMessage(`${bundle.previousYearMonth} の次月課題を当月課題へコピーしました。保存すると反映されます。`);
    });
  }

  function updateTeamField<K extends keyof TeamReportFields>(key: K, value: TeamReportFields[K]) {
    setTeamReport((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePersonalField<K extends keyof PersonalReportFields>(key: K, value: PersonalReportFields[K]) {
    setPersonalReport((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleYearMonthChange(nextYearMonth: string) {
    setYearMonth(nextYearMonth);
    if (!newProjectName.trim() && selectedProjectId) {
      startTransition(async () => {
        await reloadEditor(nextYearMonth, selectedProjectId);
      });
    } else {
      setTeamReport(createEmptyTeamReport());
      setPersonalReport(createEmptyPersonalReport());
    }
  }

  function handleProjectSelect(nextProjectId: string) {
    setSelectedProjectId(nextProjectId);
    setNewProjectName("");
    setMessage(null);

    if (!nextProjectId) {
      setTeamReport(createEmptyTeamReport());
      setPersonalReport(createEmptyPersonalReport());
      return;
    }

    startTransition(async () => {
      await reloadEditor(yearMonth, nextProjectId);
    });
  }

  function handleNewProjectNameChange(value: string) {
    setNewProjectName(value);
    if (value.trim()) {
      setSelectedProjectId("");
      setTeamReport(createEmptyTeamReport());
      setPersonalReport(createEmptyPersonalReport());
    }
  }

  async function handleSave() {
    setMessage(null);

    if (!yearMonth) {
      setMessage("年月を入力してください。");
      return;
    }

    if (!selectedProjectId && !newProjectName.trim()) {
      setMessage("既存プロジェクトを選択するか、新しいプロジェクト名を入力してください。");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/monthly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth,
          projectId: selectedProjectId || undefined,
          projectName: selectedProjectId ? undefined : newProjectName,
          teamReport: bundle.permissions.canEditTeamReport ? teamReport : undefined,
          personalReport,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        projectId?: string;
      } | null;

      setMessage(payload?.message ?? (response.ok ? "月報を保存しました。" : "月報の保存に失敗しました。"));

      if (!response.ok) {
        return;
      }

      const nextProjectId = payload?.projectId ?? selectedProjectId;
      if (nextProjectId) {
        setSelectedProjectId(nextProjectId);
        setNewProjectName("");
        await reloadEditor(yearMonth, nextProjectId);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-6">
      <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Monthly Report</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">月報入力</h2>
            <p className="mt-2 text-sm text-slate-600">年月、プロジェクト、チームと個人のふりかえりをまとめて保存します。</p>
          </div>
          <div className="flex gap-3">
            <Link href="/monthly-report/list" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
              月報一覧を見る
            </Link>
            <Link href="/monthly-report" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
              月報メニューへ
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "保存中..." : "月報を保存"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm text-slate-700">
            年月
            <input
              type="month"
              value={yearMonth}
              onChange={(event) => handleYearMonthChange(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
            />
          </label>
          <label className="text-sm text-slate-700 xl:col-span-2">
            既存プロジェクト
            <select
              value={selectedProjectId}
              onChange={(event) => handleProjectSelect(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
            >
              <option value="">選択してください</option>
              {bundle.projectOptions.map((option) => (
                <option key={option.projectId} value={option.projectId}>
                  {option.projectName} / {option.teamName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700 xl:col-span-2">
            新しいプロジェクト名
            <input
              value={newProjectName}
              onChange={(event) => handleNewProjectNameChange(event.target.value)}
              placeholder="候補にない場合はこちらへ入力"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
            />
          </label>
          <label className="text-sm text-slate-700">
            チーム名
            <input
              value={readValue(currentProject?.teamName ?? bundle.viewer.teamName)}
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none"
            />
          </label>
          <label className="text-sm text-slate-700">
            氏名
            <input
              value={bundle.viewer.name}
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none"
            />
          </label>
          <label className="text-sm text-slate-700">
            ロール
            <input
              value={bundle.viewer.role}
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none"
            />
          </label>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </article>

      {showTeamSection ? (
        <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">チームとして</h2>
              <p className="mt-2 text-sm text-slate-600">プロジェクト概要と、当月課題・当月結果・次月課題を記録します。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {bundle.permissions.canEditTeamReport ? (
                <button
                  type="button"
                  onClick={() => copyFromPreviousMonth("team")}
                  disabled={isPending || !selectedProjectId}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bundle.previousYearMonth} をコピー
                </button>
              ) : (
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">リーダーのみ編集可</span>
              )}
            </div>
          </div>
          {showAnnualGoalOnTeamSection(bundle) ? (
            <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Annual Direction</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{bundle.annualGoalReference?.fiscalYear}年度のチーム年度方針</h3>
                  <p className="mt-1 text-sm text-amber-900">月報の記載にあたって、年度で定めた重点方針を確認できます。</p>
                </div>
                <Link href={`/annual-goals/${bundle.annualGoalReference?.id}`} className="w-fit rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100">
                  年度方針を確認
                </Link>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl bg-white/80 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">年度の優先テーマ</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-900">{bundle.annualGoalReference?.priorityTheme || "未設定"}</p>
                </section>
                <section className="rounded-2xl bg-white/80 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-500">年度目標</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-900">{bundle.annualGoalReference?.annualGoal || "未設定"}</p>
                </section>
              </div>
            </div>
          ) : null}
          <div className="mt-6 grid gap-4">
            <label className="text-sm text-slate-700">
              プロジェクト概要
              <textarea
                value={teamReport.projectSummary}
                onChange={(event) => updateTeamField("projectSummary", event.target.value)}
                readOnly={!bundle.permissions.canEditTeamReport}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none read-only:bg-slate-50"
              />
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-sm text-slate-700">
                チーム自律的成長 当月課題
                <textarea
                  value={teamReport.teamSelfGrowthIssue}
                  onChange={(event) => updateTeamField("teamSelfGrowthIssue", event.target.value)}
                  readOnly={!bundle.permissions.canEditTeamReport}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none read-only:bg-slate-50"
                />
              </label>
              <label className="text-sm text-slate-700">
                チーム自律的成長 当月結果
                <textarea
                  value={teamReport.teamSelfGrowthResult}
                  onChange={(event) => updateTeamField("teamSelfGrowthResult", event.target.value)}
                  readOnly={!bundle.permissions.canEditTeamReport}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none read-only:bg-slate-50"
                />
              </label>
              <label className="text-sm text-slate-700">
                チーム協調相乗 当月課題
                <textarea
                  value={teamReport.teamSynergyIssue}
                  onChange={(event) => updateTeamField("teamSynergyIssue", event.target.value)}
                  readOnly={!bundle.permissions.canEditTeamReport}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none read-only:bg-slate-50"
                />
              </label>
              <label className="text-sm text-slate-700">
                チーム協調相乗 当月結果
                <textarea
                  value={teamReport.teamSynergyResult}
                  onChange={(event) => updateTeamField("teamSynergyResult", event.target.value)}
                  readOnly={!bundle.permissions.canEditTeamReport}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none read-only:bg-slate-50"
                />
              </label>
              <label className="text-sm text-slate-700">
                チーム自律的成長 次月課題
                <textarea
                  value={teamReport.teamSelfGrowthNextIssue}
                  onChange={(event) => updateTeamField("teamSelfGrowthNextIssue", event.target.value)}
                  readOnly={!bundle.permissions.canEditTeamReport}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none read-only:bg-slate-50"
                />
              </label>
              <label className="text-sm text-slate-700">
                チーム協調相乗 次月課題
                <textarea
                  value={teamReport.teamSynergyNextIssue}
                  onChange={(event) => updateTeamField("teamSynergyNextIssue", event.target.value)}
                  readOnly={!bundle.permissions.canEditTeamReport}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none read-only:bg-slate-50"
                />
              </label>
            </div>
          </div>
        </article>
      ) : null}

      <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">個人として</h2>
            <p className="mt-2 text-sm text-slate-600">ご自身の役割と、当月課題・当月結果・次月課題を入力します。</p>
          </div>
          <button
            type="button"
            onClick={() => copyFromPreviousMonth("personal")}
            disabled={isPending || !selectedProjectId}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bundle.previousYearMonth} をコピー
          </button>
        </div>
        {showAnnualGoalOnPersonalSection(bundle) ? (
          <div className="mt-6 rounded-[1.5rem] border border-sky-200 bg-sky-50/80 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Annual Direction</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{bundle.annualGoalReference?.fiscalYear}年度の個人年度方針</h3>
                <p className="mt-1 text-sm text-sky-900">未所属のため、個人で定めた年度方針を確認しながら月報を記載できます。</p>
              </div>
              <Link href={`/annual-goals/${bundle.annualGoalReference?.id}`} className="w-fit rounded-full border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100">
                年度方針を確認
              </Link>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl bg-white/80 px-4 py-4">
                <p className="text-sm font-semibold text-slate-500">年度の優先テーマ</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-900">{bundle.annualGoalReference?.priorityTheme || "未設定"}</p>
              </section>
              <section className="rounded-2xl bg-white/80 px-4 py-4">
                <p className="text-sm font-semibold text-slate-500">年度目標</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-900">{bundle.annualGoalReference?.annualGoal || "未設定"}</p>
              </section>
            </div>
          </div>
        ) : null}
        <div className="mt-6 grid gap-4">
          <label className="text-sm text-slate-700">
            プロジェクト内役割
            <input
              value={personalReport.projectRole}
              onChange={(event) => updatePersonalField("projectRole", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
            />
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm text-slate-700">
              個人自律的成長 当月課題
              <textarea
                value={personalReport.personalSelfGrowthIssue}
                onChange={(event) => updatePersonalField("personalSelfGrowthIssue", event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              個人自律的成長 当月結果
              <textarea
                value={personalReport.personalSelfGrowthResult}
                onChange={(event) => updatePersonalField("personalSelfGrowthResult", event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              個人協調相乗 当月課題
              <textarea
                value={personalReport.personalSynergyIssue}
                onChange={(event) => updatePersonalField("personalSynergyIssue", event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              個人協調相乗 当月結果
              <textarea
                value={personalReport.personalSynergyResult}
                onChange={(event) => updatePersonalField("personalSynergyResult", event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              個人自律的成長 次月課題
              <textarea
                value={personalReport.personalSelfGrowthNextIssue}
                onChange={(event) => updatePersonalField("personalSelfGrowthNextIssue", event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              個人協調相乗 次月課題
              <textarea
                value={personalReport.personalSynergyNextIssue}
                onChange={(event) => updatePersonalField("personalSynergyNextIssue", event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none"
              />
            </label>
          </div>
        </div>
      </article>
    </section>
  );
}
