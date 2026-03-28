"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  UserDepartmentOption,
  UserManagementRow,
  UserMembershipHistoryRow,
  UserRoleOption,
  UserTeamOption,
} from "@/lib/users/user-management-service";

type UserManagementEditorProps = {
  rows: UserManagementRow[];
  roleOptions: UserRoleOption[];
  departmentOptions: UserDepartmentOption[];
  teamOptions: UserTeamOption[];
  membershipHistoryMap: Record<string, UserMembershipHistoryRow[]>;
  initialDepartmentId?: string;
  initialTeamId?: string;
  initialUnassignedOnly?: boolean;
  canEdit: boolean;
};

type CreateUserForm = {
  employeeCode: string;
  name: string;
  email: string;
  roleId: string;
  departmentId: string;
  teamId: string;
  joinedAt: string;
  membershipStartDate: string;
  password: string;
};

type TeamAssignmentForm = {
  userId: string;
  departmentId: string;
  teamId: string;
  startDate: string;
};

type MembershipEditForm = {
  membershipId: string;
  startDate: string;
  endDate: string;
};

const emptyCreateForm: CreateUserForm = {
  employeeCode: "",
  name: "",
  email: "",
  roleId: "",
  departmentId: "",
  teamId: "",
  joinedAt: "",
  membershipStartDate: "",
  password: "",
};

const emptyAssignmentForm: TeamAssignmentForm = {
  userId: "",
  departmentId: "",
  teamId: "",
  startDate: "",
};

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMembershipEditMap(historyMap: Record<string, UserMembershipHistoryRow[]>) {
  return Object.fromEntries(
    Object.values(historyMap)
      .flat()
      .map((row) => [
        row.membershipId,
        {
          membershipId: row.membershipId,
          startDate: row.startDateValue,
          endDate: row.endDateValue,
        },
      ]),
  ) as Record<string, MembershipEditForm>;
}

type MenuVisibilityKey = keyof UserManagementRow["menuVisibility"];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function UserManagementEditor({ rows, roleOptions, departmentOptions, teamOptions, membershipHistoryMap, initialDepartmentId = "", initialTeamId = "", initialUnassignedOnly = false, canEdit }: UserManagementEditorProps) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState(rows[0]?.userId ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "retired">("all");
  const [departmentFilter, setDepartmentFilter] = useState(initialDepartmentId);
  const [teamFilter, setTeamFilter] = useState(initialTeamId);
  const [roleFilter, setRoleFilter] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(initialUnassignedOnly);
  const [keyword, setKeyword] = useState("");
  const [editableRows, setEditableRows] = useState(rows);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    ...emptyCreateForm,
    roleId: roleOptions[0]?.roleId ?? "",
  });
  const [assignmentForm, setAssignmentForm] = useState<TeamAssignmentForm>({
    ...emptyAssignmentForm,
    userId: rows[0]?.userId ?? "",
    startDate: getTodayDateInput(),
  });
  const [membershipEditMap, setMembershipEditMap] = useState<Record<string, MembershipEditForm>>(
    buildMembershipEditMap(membershipHistoryMap),
  );

  const teamOptionsByDepartment = useMemo(() => {
    const grouped = new Map<string, UserTeamOption[]>();
    for (const option of teamOptions) {
      const key = option.departmentId || "";
      grouped.set(key, [...(grouped.get(key) ?? []), option]);
    }
    return grouped;
  }, [teamOptions]);



  const visibleRows = useMemo(() => {
    const normalizedKeyword = normalize(keyword);
    return editableRows.filter((row) => {
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" && row.status === "ACTIVE")
        || (statusFilter === "retired" && row.status === "INACTIVE");
      const matchesDepartment = !departmentFilter || row.departmentId === departmentFilter;
      const matchesTeam = !teamFilter || row.teamId === teamFilter;
      const matchesRole = !roleFilter || row.roleId === roleFilter;
      const matchesUnassigned = !unassignedOnly || !row.teamId;

      if (!matchesStatus || !matchesDepartment || !matchesTeam || !matchesRole || !matchesUnassigned) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [row.employeeCode, row.name, row.email].some((value) => normalize(value).includes(normalizedKeyword));
    });
  }, [editableRows, statusFilter, departmentFilter, teamFilter, roleFilter, unassignedOnly, keyword]);

  function getTeamsForDepartment(departmentId: string) {
    if (!departmentId) {
      return teamOptions;
    }
    return teamOptionsByDepartment.get(departmentId) ?? [];
  }

  function updateEditableRow(userId: string, key: "name" | "email" | "roleId" | "status", value: string) {
    setEditableRows((current) => current.map((row) => {
      if (row.userId !== userId) return row;
      if (key === "name" || key === "email") {
        return {
          ...row,
          [key]: value,
        };
      }
      if (key === "roleId") {
        const role = roleOptions.find((option) => option.roleId === value);
        return {
          ...row,
          roleId: value,
          roleCode: role?.roleCode ?? row.roleCode,
          roleName: role?.roleName ?? row.roleName,
        };
      }
      return {
        ...row,
        status: value,
        teamId: value === "INACTIVE" ? "" : row.teamId,
        teamName: value === "INACTIVE" ? "退職" : row.teamName,
      };
    }));
  }

  function updateCreateForm<K extends keyof CreateUserForm>(key: K, value: CreateUserForm[K]) {
    setCreateForm((current) => {
      if (key === "departmentId") {
        const nextDepartmentId = String(value);
        const availableTeams = getTeamsForDepartment(nextDepartmentId);
        const keepTeam = availableTeams.some((option) => option.teamId === current.teamId);
        return {
          ...current,
          departmentId: nextDepartmentId,
          teamId: keepTeam ? current.teamId : "",
        };
      }
      if (key === "joinedAt") {
        const nextJoinedAt = String(value);
        return {
          ...current,
          joinedAt: nextJoinedAt,
          membershipStartDate: current.membershipStartDate || !current.teamId ? nextJoinedAt : current.membershipStartDate,
        };
      }
      return {
        ...current,
        [key]: value,
      };
    });
  }

  function updateAssignmentForm<K extends keyof TeamAssignmentForm>(key: K, value: TeamAssignmentForm[K]) {
    setAssignmentForm((current) => {
      if (key === "departmentId") {
        const nextDepartmentId = String(value);
        const availableTeams = getTeamsForDepartment(nextDepartmentId);
        const keepTeam = availableTeams.some((option) => option.teamId === current.teamId);
        return {
          ...current,
          departmentId: nextDepartmentId,
          teamId: keepTeam ? current.teamId : "",
        };
      }
      return {
        ...current,
        [key]: value,
      };
    });
  }


  function updateMembershipEdit(membershipId: string, key: "startDate" | "endDate", value: string) {
    setMembershipEditMap((current) => ({
      ...current,
      [membershipId]: {
        ...(current[membershipId] ?? { membershipId, startDate: "", endDate: "" }),
        [key]: value,
      },
    }));
  }

  function toggleMenuVisibility(userId: string, key: MenuVisibilityKey, checked: boolean) {
    setEditableRows((current) => current.map((row) => (
      row.userId === userId
        ? {
            ...row,
            menuVisibility: {
              ...row.menuVisibility,
              [key]: checked,
            },
          }
        : row
    )));
  }

  function resetFilters() {
    setKeyword("");
    setStatusFilter("all");
    setDepartmentFilter("");
    setTeamFilter("");
    setRoleFilter("");
    setUnassignedOnly(false);
  }

  async function handlePasswordChange() {
    if (!selectedUserId || !password) {
      setMessage("対象ユーザーと新しいパスワードを入力してください。");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, password }),
      });

      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? (response.ok ? "更新しました" : "更新に失敗しました"));

      if (response.ok) {
        setPassword("");
        router.refresh();
      }
    });
  }

  async function handleProfileSave() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/users/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: editableRows.map((row) => ({
            userId: row.userId,
            name: row.name,
            email: row.email,
            roleId: row.roleId,
            status: row.status,
            departmentId: row.departmentId,
            teamId: row.status === "INACTIVE" ? "" : row.teamId,
            menuVisibility: row.menuVisibility,
          })),
        }),
      });

      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? (response.ok ? "更新しました" : "更新に失敗しました"));
      if (response.ok) {
        router.refresh();
      }
    });
  }

  async function handleAssignmentChange() {
    if (!assignmentForm.userId || !assignmentForm.teamId || !assignmentForm.startDate) {
      setMessage("所属変更の対象ユーザー、チーム、所属開始日を入力してください。");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/users/assign-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignmentForm),
      });

      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? (response.ok ? "所属を変更しました" : "所属変更に失敗しました"));
      if (response.ok) {
        setAssignmentForm({
          ...emptyAssignmentForm,
          userId: assignmentForm.userId,
          startDate: getTodayDateInput(),
        });
        router.refresh();
      }
    });
  }

  async function handleMembershipHistorySave(membershipId: string, forceEndDate?: string) {
    const edit = membershipEditMap[membershipId];
    const payload = {
      membershipId,
      startDate: edit?.startDate ?? "",
      endDate: forceEndDate ?? edit?.endDate ?? "",
    };

    if (!payload.startDate) {
      setMessage("所属開始日を入力してください。");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/users/membership-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as { message?: string };
      setMessage(responsePayload.message ?? (response.ok ? "所属履歴を更新しました" : "所属履歴の更新に失敗しました"));
      if (response.ok) {
        router.refresh();
      }
    });
  }


  async function handleMembershipHistoryDelete(membershipId: string) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/users/membership-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      });

      const responsePayload = (await response.json()) as { message?: string };
      setMessage(responsePayload.message ?? (response.ok ? "所属履歴を削除しました" : "所属履歴の削除に失敗しました"));
      if (response.ok) {
        router.refresh();
      }
    });
  }

  async function handleCreateUser() {
    if (!createForm.employeeCode || !createForm.name || !createForm.email || !createForm.roleId || !createForm.password || !createForm.joinedAt) {
      setMessage("新規ユーザーの必須項目を入力してください。");
      return;
    }

    if (createForm.teamId && !createForm.membershipStartDate) {
      setMessage("初期所属チームを設定する場合は所属開始日を入力してください。");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? (response.ok ? "作成しました" : "作成に失敗しました"));
      if (response.ok) {
        setCreateForm({
          ...emptyCreateForm,
          roleId: roleOptions[0]?.roleId ?? "",
        });
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-6">
      <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">ユーザー作成</h2>
            <p className="mt-1 text-sm text-slate-500">社員No.、所属、初期パスワードを設定して新規ユーザーを登録します。</p>
          </div>
          <button type="button" onClick={handleCreateUser} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isPending ? "処理中..." : "ユーザー作成"}
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-700">
            社員No.
            <input value={createForm.employeeCode} disabled={!canEdit || isPending} onChange={(event) => updateCreateForm("employeeCode", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
          </label>
          <label className="text-sm text-slate-700">
            氏名
            <input value={createForm.name} disabled={!canEdit || isPending} onChange={(event) => updateCreateForm("name", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
          </label>
          <label className="text-sm text-slate-700">
            メール
            <input type="email" value={createForm.email} disabled={!canEdit || isPending} onChange={(event) => updateCreateForm("email", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
          </label>
          <label className="text-sm text-slate-700">
            入社日
            <input type="date" value={createForm.joinedAt} disabled={!canEdit || isPending} onChange={(event) => updateCreateForm("joinedAt", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
          </label>
          <label className="text-sm text-slate-700">
            初期パスワード
            <input type="password" value={createForm.password} disabled={!canEdit || isPending} onChange={(event) => updateCreateForm("password", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
          </label>
          <label className="text-sm text-slate-700">
            ロール
            <select value={createForm.roleId} disabled={!canEdit || isPending} onChange={(event) => updateCreateForm("roleId", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              {roleOptions.map((option) => (
                <option key={option.roleId} value={option.roleId}>{option.roleName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            部署
            <select value={createForm.departmentId} disabled={!canEdit || isPending} onChange={(event) => updateCreateForm("departmentId", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              <option value="">未設定</option>
              {departmentOptions.map((option) => (
                <option key={option.departmentId} value={option.departmentId}>{option.departmentName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            チーム
            <select value={createForm.teamId} disabled={!canEdit || isPending} onChange={(event) => updateCreateForm("teamId", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              <option value="">未所属</option>
              {getTeamsForDepartment(createForm.departmentId).map((option) => (
                <option key={option.teamId} value={option.teamId}>{option.teamName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            所属開始日
            <input type="date" value={createForm.membershipStartDate} disabled={!canEdit || isPending || !createForm.teamId} onChange={(event) => updateCreateForm("membershipStartDate", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none disabled:bg-slate-100" />
          </label>
        </div>
      </article>

      <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">ユーザー一覧</h2>
            <p className="mt-1 text-sm text-slate-500">検索しながら、基本情報と表示設定を更新できます。所属は下の専用入力と所属履歴で管理します。</p>
          </div>
          <div className="flex items-center gap-3">
            {!canEdit ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">閲覧専用</span> : null}
            <button type="button" onClick={handleProfileSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {isPending ? "更新中..." : "ユーザー設定保存"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6 xl:items-end">
          <label className="text-sm text-slate-700 xl:col-span-2">
            検索
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="社員No. / 氏名 / メール" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
          </label>
          <label className="text-sm text-slate-700">
            在籍状態
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "retired")} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              <option value="all">すべて</option>
              <option value="active">在籍のみ</option>
              <option value="retired">退職のみ</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            部署
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              <option value="">すべて</option>
              {departmentOptions.map((option) => (
                <option key={option.departmentId} value={option.departmentId}>{option.departmentName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            チーム
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              <option value="">すべて</option>
              {getTeamsForDepartment(departmentFilter).map((option) => (
                <option key={option.teamId} value={option.teamId}>{option.teamName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            ロール
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              <option value="">すべて</option>
              {roleOptions.map((option) => (
                <option key={option.roleId} value={option.roleId}>{option.roleName}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 xl:self-end">
            <input type="checkbox" checked={unassignedOnly} onChange={(event) => setUnassignedOnly(event.target.checked)} />
            未所属のみ
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={resetFilters} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            条件クリア
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-500">表示件数: {visibleRows.length} / {editableRows.length}</p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1800px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">社員No.</th>
                <th className="w-[240px] px-4 py-3 font-medium">氏名</th>
                <th className="w-[320px] px-4 py-3 font-medium">メール</th>
                <th className="px-4 py-3 font-medium">入社日</th>
                <th className="px-4 py-3 font-medium">ロール</th>
                <th className="px-4 py-3 font-medium">部署</th>
                <th className="px-4 py-3 font-medium">所属</th>
                <th className="px-4 py-3 font-medium">理念実践管理</th>
                <th className="px-4 py-3 font-medium">月報作成</th>
                <th className="px-4 py-3 font-medium">給与明細</th>
                <th className="px-4 py-3 font-medium">経費精算</th>
                <th className="px-4 py-3 font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.userId} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-950">{row.employeeCode}</td>
                  <td className="w-[240px] px-4 py-3 text-slate-700">
                    <input value={row.name} disabled={!canEdit || isPending} onChange={(event) => updateEditableRow(row.userId, "name", event.target.value)} className="w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="w-[320px] px-4 py-3 text-slate-700">
                    <input type="email" value={row.email} disabled={!canEdit || isPending} onChange={(event) => updateEditableRow(row.userId, "email", event.target.value)} className="w-[300px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.joinedAt}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <select value={row.roleId} disabled={!canEdit || isPending} onChange={(event) => updateEditableRow(row.userId, "roleId", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      {roleOptions.map((option) => (
                        <option key={option.roleId} value={option.roleId}>{option.roleName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.departmentName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.teamName}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={row.menuVisibility.philosophyPractice} disabled={!canEdit || isPending} onChange={(event) => toggleMenuVisibility(row.userId, "philosophyPractice", event.target.checked)} />
                      表示
                    </label>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={row.menuVisibility.monthlyReport} disabled={!canEdit || isPending} onChange={(event) => toggleMenuVisibility(row.userId, "monthlyReport", event.target.checked)} />
                      表示
                    </label>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={row.menuVisibility.salaryStatement} disabled={!canEdit || isPending} onChange={(event) => toggleMenuVisibility(row.userId, "salaryStatement", event.target.checked)} />
                      表示
                    </label>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={row.menuVisibility.expenseSettlement} disabled={!canEdit || isPending} onChange={(event) => toggleMenuVisibility(row.userId, "expenseSettlement", event.target.checked)} />
                      表示
                    </label>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <select value={row.status} disabled={!canEdit || isPending} onChange={(event) => updateEditableRow(row.userId, "status", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE(退職)</option>
                    </select>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr className="border-t border-slate-200">
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">条件に一致するユーザーがいません。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">所属変更</h2>
            <p className="mt-1 text-sm text-slate-500">異動時は専用入力から所属開始日を指定して更新します。旧所属は開始日の前日で終了します。</p>
          </div>
          <button type="button" onClick={handleAssignmentChange} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isPending ? "処理中..." : "所属変更"}
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="text-sm text-slate-700">
            対象ユーザー
            <select value={assignmentForm.userId} disabled={!canEdit || isPending} onChange={(event) => updateAssignmentForm("userId", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              {rows.filter((row) => row.status === "ACTIVE").map((row) => (
                <option key={row.userId} value={row.userId}>{row.employeeCode} / {row.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            部署
            <select value={assignmentForm.departmentId} disabled={!canEdit || isPending} onChange={(event) => updateAssignmentForm("departmentId", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              <option value="">選択してください</option>
              {departmentOptions.map((option) => (
                <option key={option.departmentId} value={option.departmentId}>{option.departmentName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            新所属チーム
            <select value={assignmentForm.teamId} disabled={!canEdit || isPending} onChange={(event) => updateAssignmentForm("teamId", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              <option value="">選択してください</option>
              {getTeamsForDepartment(assignmentForm.departmentId).map((option) => (
                <option key={option.teamId} value={option.teamId}>{option.teamName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            所属開始日
            <input type="date" value={assignmentForm.startDate} disabled={!canEdit || isPending} onChange={(event) => updateAssignmentForm("startDate", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
          </label>
        </div>
      </article>

      <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <h2 className="text-xl font-semibold text-slate-950">所属履歴</h2>
        <p className="mt-1 text-sm text-slate-500">対象ユーザーの所属開始日・終了日を確認できます。異動は上の専用入力から追加してください。</p>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="text-sm text-slate-700">
            対象ユーザー
            <select value={selectedUserId} disabled={isPending} onChange={(event) => setSelectedUserId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              {rows.map((row) => (
                <option key={row.userId} value={row.userId}>{row.employeeCode} / {row.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">部署</th>
                <th className="px-4 py-3 font-medium">チーム</th>
                <th className="px-4 py-3 font-medium">所属開始日</th>
                <th className="px-4 py-3 font-medium">所属終了日</th>
                <th className="px-4 py-3 font-medium">主所属</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {(membershipHistoryMap[selectedUserId] ?? []).map((history) => {
                const edit = membershipEditMap[history.membershipId] ?? {
                  membershipId: history.membershipId,
                  startDate: history.startDateValue,
                  endDate: history.endDateValue,
                };

                return (
                  <tr key={history.membershipId} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{history.departmentName}</td>
                    <td className="px-4 py-3 text-slate-700">{history.teamName}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <input type="date" value={edit.startDate} disabled={!canEdit || isPending} onChange={(event) => updateMembershipEdit(history.membershipId, "startDate", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <input type="date" value={edit.endDate} disabled={!canEdit || isPending} onChange={(event) => updateMembershipEdit(history.membershipId, "endDate", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{history.isPrimary ? "主所属" : "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleMembershipHistorySave(history.membershipId)} disabled={!canEdit || isPending} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60">
                          保存
                        </button>
                        {!edit.endDate ? (
                          <button type="button" onClick={() => handleMembershipHistorySave(history.membershipId, getTodayDateInput())} disabled={!canEdit || isPending} className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 disabled:opacity-60">
                            未所属にする
                          </button>
                        ) : null}
                        <button type="button" onClick={() => handleMembershipHistoryDelete(history.membershipId)} disabled={!canEdit || isPending} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(membershipHistoryMap[selectedUserId] ?? []).length === 0 ? (
                <tr className="border-t border-slate-200">
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">所属履歴がありません。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <h2 className="text-xl font-semibold text-slate-950">パスワード変更</h2>
        <p className="mt-1 text-sm text-slate-500">管理者がユーザーのログインパスワードを再設定します。</p>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm text-slate-700">
            対象ユーザー
            <select value={selectedUserId} disabled={!canEdit || isPending} onChange={(event) => setSelectedUserId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none">
              {rows.map((row) => (
                <option key={row.userId} value={row.userId}>{row.employeeCode} / {row.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            新しいパスワード
            <input type="password" value={password} disabled={!canEdit || isPending} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none" />
          </label>
          <button type="button" onClick={handlePasswordChange} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isPending ? "更新中..." : "パスワード更新"}
          </button>
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </article>
    </section>
  );
}
