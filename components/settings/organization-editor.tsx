"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  OrganizationBundle,
  OrganizationDepartmentRow,
  OrganizationTeamRow,
  OrganizationUnassignedMemberRow,
} from "@/lib/organization/organization-service";

type OrganizationEditorProps = {
  canEdit: boolean;
  defaults: OrganizationBundle;
};

function createDepartmentRow(): OrganizationDepartmentRow {
  return { id: "", name: "" };
}

function createTeamRow(defaultDepartmentId = ""): OrganizationTeamRow {
  return {
    id: "",
    name: "",
    departmentId: defaultDepartmentId,
    departmentName: "",
    leaderUserId: "",
    leaderUserName: "",
    memberCount: 0,
    memberNames: [],
    isActive: true,
  };
}

export function OrganizationEditor({ canEdit, defaults }: OrganizationEditorProps) {
  const router = useRouter();
  const [departments, setDepartments] = useState(defaults.departments);
  const [teams, setTeams] = useState(defaults.teams);
  const [message, setMessage] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [assignmentTeamByUser, setAssignmentTeamByUser] = useState<Record<string, string>>({});

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const departmentA = departments.find((department) => department.id === a.departmentId)?.name ?? "";
      const departmentB = departments.find((department) => department.id === b.departmentId)?.name ?? "";
      const departmentCompare = departmentA.localeCompare(departmentB, "ja");
      if (departmentCompare !== 0) return departmentCompare;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [departments, teams]);

  function getAssignableTeams(member: OrganizationUnassignedMemberRow) {
    const activeTeams = sortedTeams.filter((team) => team.isActive && team.name.trim());
    if (!member.departmentId) {
      return activeTeams;
    }
    const teamsInDepartment = activeTeams.filter((team) => team.departmentId === member.departmentId);
    return teamsInDepartment.length > 0 ? teamsInDepartment : activeTeams;
  }

  async function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departments, teams }),
      });
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました" : "保存に失敗しました"));
      if (response.ok) router.refresh();
    });
  }

  async function handleAssignUnassigned(member: OrganizationUnassignedMemberRow) {
    const teamId = assignmentTeamByUser[member.userId] ?? "";
    if (!teamId) {
      setAssignmentMessage("割り当て先のチームを選択してください。");
      return;
    }

    setAssignmentMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/users/assign-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, teamId }),
      });
      const result = (await response.json()) as { message?: string };
      setAssignmentMessage(result.message ?? (response.ok ? "所属を更新しました" : "所属更新に失敗しました"));
      if (response.ok) {
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">組織構成</h2>
        <p className="mt-1 text-sm text-slate-500">部署、チーム、チームリーダーを管理します。所属メンバーの付け替えはユーザー管理で行います。</p>
        {defaults.unassignedMembers.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">未所属メンバー {defaults.unassignedMembers.length}名</p>
            <p className="mt-1 text-amber-800">{defaults.unassignedMembers.map((member) => `${member.userName}（${member.departmentName}）`).join(" / ")}</p>
            <Link href="/settings/users?unassigned=1" className="mt-2 inline-block font-medium underline-offset-2 hover:underline">
              未所属のみをユーザー管理で開く
            </Link>
          </div>
        ) : null}
      </div>

      <section className="rounded-3xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-950">部署</h3>
            <p className="mt-1 text-sm text-slate-500">部署名を管理します。部署単位でもユーザー管理へ移動できます。</p>
          </div>
          <button type="button" disabled={!canEdit || isPending} onClick={() => setDepartments((current) => [...current, createDepartmentRow()])} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">
            部署を追加
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">部署名</th>
                <th className="px-4 py-3 font-medium">導線</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department, index) => (
                <tr key={department.id || `new-dept-${index}`} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={department.name}
                      disabled={!canEdit || isPending}
                      onChange={(event) => setDepartments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {department.id ? (
                      <Link href={`/settings/users?departmentId=${department.id}`} className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline">
                        この部署をユーザー管理で開く
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">保存後に利用できます</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-950">チーム</h3>
            <p className="mt-1 text-sm text-slate-500">部署順に並べて表示します。所属変更は各チームからユーザー管理へ移動できます。</p>
          </div>
          <button type="button" disabled={!canEdit || isPending} onClick={() => setTeams((current) => [...current, createTeamRow(departments[0]?.id ?? "")])} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">
            チームを追加
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">チーム名</th>
                <th className="px-4 py-3 font-medium">部署</th>
                <th className="px-4 py-3 font-medium">チームリーダー</th>
                <th className="px-4 py-3 font-medium">所属メンバー</th>
                <th className="px-4 py-3 font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, index) => (
                <tr key={team.id || `new-team-${index}`} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={team.name}
                      disabled={!canEdit || isPending}
                      onChange={(event) => setTeams((current) => current.map((item) => item === team ? { ...item, name: event.target.value } : item))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={team.departmentId}
                      disabled={!canEdit || isPending}
                      onChange={(event) => setTeams((current) => current.map((item) => item === team ? { ...item, departmentId: event.target.value } : item))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">未設定</option>
                      {departments.filter((department) => department.name.trim()).map((department) => (
                        <option key={department.id || department.name} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={team.leaderUserId}
                      disabled={!canEdit || isPending}
                      onChange={(event) => setTeams((current) => current.map((item) => item === team ? { ...item, leaderUserId: event.target.value } : item))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">未設定</option>
                      {defaults.leaderOptions.map((leader) => (
                        <option key={leader.userId} value={leader.userId}>{leader.userName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <p className="font-medium text-slate-900">{team.memberCount}名</p>
                    <p className="mt-1 text-xs text-slate-500">{team.memberNames.length > 0 ? team.memberNames.join(" / ") : "所属メンバーなし"}</p>
                    {team.id ? (
                      <Link href={`/settings/users?departmentId=${team.departmentId}&teamId=${team.id}`} className="mt-2 inline-block text-xs font-medium text-brand-700 underline-offset-2 hover:underline">
                        このチームの所属をユーザー管理で変更
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={team.isActive}
                        disabled={!canEdit || isPending}
                        onChange={(event) => setTeams((current) => current.map((item) => item === team ? { ...item, isActive: event.target.checked } : item))}
                      />
                      有効
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-950">未所属メンバー</h3>
            <p className="mt-1 text-sm text-slate-500">チーム未所属の社員を確認し、その場でチームへ割り当てられます。</p>
          </div>
          <Link href="/settings/users?unassigned=1" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            ユーザー管理で開く
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">部署</th>
                <th className="px-4 py-3 font-medium">割当先チーム</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {defaults.unassignedMembers.length === 0 ? (
                <tr className="border-t border-slate-200">
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">未所属メンバーはいません。</td>
                </tr>
              ) : (
                defaults.unassignedMembers.map((member) => {
                  const assignableTeams = getAssignableTeams(member);
                  return (
                    <tr key={member.userId} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-900">{member.userName}</td>
                      <td className="px-4 py-3 text-slate-700">{member.departmentName}</td>
                      <td className="px-4 py-3">
                        <select
                          value={assignmentTeamByUser[member.userId] ?? ""}
                          disabled={!canEdit || isPending}
                          onChange={(event) => setAssignmentTeamByUser((current) => ({ ...current, [member.userId]: event.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">選択してください</option>
                          {assignableTeams.map((team) => (
                            <option key={team.id} value={team.id}>{team.departmentName} / {team.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={!canEdit || isPending}
                          onClick={() => handleAssignUnassigned(member)}
                          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          このチームへ割当
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {assignmentMessage ? <p className="mt-3 text-sm text-slate-600">{assignmentMessage}</p> : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "組織構成を保存"}
        </button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
