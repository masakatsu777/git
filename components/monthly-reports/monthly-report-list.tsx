"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { MonthlyReportGroupRow } from "@/lib/monthly-reports/service";

type MonthlyReportListProps = {
  groups: MonthlyReportGroupRow[];
};

function readText(value: string) {
  return value.trim() || "未入力";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function MonthlyReportList({ groups }: MonthlyReportListProps) {
  const [openGroupKey, setOpenGroupKey] = useState<string>("");
  const [selectedMemberKey, setSelectedMemberKey] = useState<string>("");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.key === openGroupKey) ?? null,
    [groups, openGroupKey],
  );
  const selectedMember = useMemo(
    () => selectedGroup?.members.find((member) => `${selectedGroup.key}:${member.userId}` === selectedMemberKey) ?? null,
    [selectedGroup, selectedMemberKey],
  );

  return (
    <section className="space-y-4">
      {groups.map((group) => {
        const isOpen = group.key === openGroupKey;
        const showTeamSection = group.teamName !== "個人" && group.teamReport;

        return (
          <article key={group.key} className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <button
              type="button"
              onClick={() => {
                setOpenGroupKey((current) => current === group.key ? "" : group.key);
                setSelectedMemberKey("");
              }}
              className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Monthly Report</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {group.yearMonth} | {group.projectName} | {group.teamName}
                </h2>
              </div>
              <span className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                {isOpen ? "閉じる" : "開く"}
              </span>
            </button>

            {isOpen ? (
              <div className="mt-6 space-y-6">
                {showTeamSection ? (
                  <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-lg font-semibold text-slate-950">チームとして</h3>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="lg:col-span-2">
                        <p className="text-sm font-medium text-slate-700">プロジェクト概要</p>
                        <p className="mt-2 whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                          {readText(group.teamReport?.projectSummary ?? "")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">チーム自律的成長課題</p>
                        <p className="mt-2 whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                          {readText(group.teamReport?.teamSelfGrowthIssue ?? "")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">チーム自律的成長実践結果</p>
                        <p className="mt-2 whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                          {readText(group.teamReport?.teamSelfGrowthResult ?? "")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">チーム協調相乗課題</p>
                        <p className="mt-2 whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                          {readText(group.teamReport?.teamSynergyIssue ?? "")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">チーム協調相乗実践結果</p>
                        <p className="mt-2 whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                          {readText(group.teamReport?.teamSynergyResult ?? "")}
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section>
                  <h3 className="text-lg font-semibold text-slate-950">氏名一覧</h3>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {group.members.map((member) => {
                      const memberKey = `${group.key}:${member.userId}`;
                      return (
                        <button
                          key={memberKey}
                          type="button"
                          onClick={() => setSelectedMemberKey((current) => current === memberKey ? "" : memberKey)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            selectedMemberKey === memberKey
                              ? "bg-slate-950 text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          {member.memberType === "leader" ? "リーダー" : "メンバー"} / {member.userName}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {selectedMember ? (
                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{selectedMember.userName}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedMember.memberType === "leader" ? "リーダー" : "メンバー"} / 最終更新 {formatDateTime(selectedMember.updatedAt)}
                        </p>
                      </div>
                      {selectedMember.canEdit ? (
                        <Link
                          href={`/monthly-report?yearMonth=${group.yearMonth}&projectId=${group.projectId}`}
                          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                        >
                          この内容を編集
                        </Link>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-700">プロジェクト内役割</p>
                        <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {readText(selectedMember.projectRole)}
                        </p>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-slate-700">個人自律的成長課題</p>
                          <p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                            {readText(selectedMember.personalReport.personalSelfGrowthIssue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">個人自律的成長実践結果</p>
                          <p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                            {readText(selectedMember.personalReport.personalSelfGrowthResult)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">個人協調相乗課題</p>
                          <p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                            {readText(selectedMember.personalReport.personalSynergyIssue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">個人協調相乗実践結果</p>
                          <p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                            {readText(selectedMember.personalReport.personalSynergyResult)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}

      {groups.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          条件に合う月報がまだありません。
        </div>
      ) : null}
    </section>
  );
}
