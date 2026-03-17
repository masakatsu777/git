import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type OrganizationDepartmentRow = {
  id: string;
  name: string;
};

export type OrganizationTeamRow = {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  leaderUserId: string;
  leaderUserName: string;
  memberCount: number;
  memberNames: string[];
  isActive: boolean;
};

export type OrganizationLeaderOption = {
  userId: string;
  userName: string;
};

export type OrganizationUnassignedMemberRow = {
  userId: string;
  userName: string;
  departmentId: string;
  departmentName: string;
};

export type OrganizationBundle = {
  departments: OrganizationDepartmentRow[];
  teams: OrganizationTeamRow[];
  leaderOptions: OrganizationLeaderOption[];
  unassignedMembers: OrganizationUnassignedMemberRow[];
  source: "database" | "fallback";
};

const fallbackBundle: OrganizationBundle = {
  departments: [
    { id: "dept-dev", name: "開発本部" },
    { id: "dept-sales", name: "営業本部" },
  ],
  teams: [
    {
      id: "team-platform",
      name: "プラットフォームチーム",
      departmentId: "dept-dev",
      departmentName: "開発本部",
      leaderUserId: "demo-leader",
      leaderUserName: "主任 次郎",
      memberCount: 3,
      memberNames: ["主任 次郎", "開発 一郎", "開発 二郎"],
      isActive: true,
    },
  ],
  leaderOptions: [
    { userId: "demo-leader", userName: "主任 次郎" },
    { userId: "demo-admin", userName: "管理 花子" },
  ],
  unassignedMembers: [
    {
      userId: "demo-employee",
      userName: "共通 太郎",
      departmentId: "dept-sales",
      departmentName: "営業本部",
    },
  ],
  source: "fallback",
};

export type SaveOrganizationInput = {
  departments: Array<{ id?: string; name: string }>;
  teams: Array<{
    id?: string;
    name: string;
    departmentId?: string;
    leaderUserId?: string;
    isActive: boolean;
  }>;
};

export async function getOrganizationBundle(): Promise<OrganizationBundle> {
  if (!hasDatabaseUrl()) {
    return fallbackBundle;
  }

  try {
    const [departments, teams, leaders, unassignedUsers] = await Promise.all([
      prisma.department.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.team.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          isActive: true,
          departmentId: true,
          department: { select: { name: true } },
          leaderUserId: true,
          leader: { select: { name: true } },
          memberships: {
            where: { endDate: null, isPrimary: true },
            orderBy: { user: { name: "asc" } },
            select: { user: { select: { name: true } } },
          },
        },
      }),
      prisma.user.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: {
          status: "ACTIVE",
          teamMemberships: {
            none: {
              isPrimary: true,
              endDate: null,
            },
          },
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          department: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      departments: departments.map((department) => ({ id: department.id, name: department.name })),
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        departmentId: team.departmentId ?? "",
        departmentName: team.department?.name ?? "未設定",
        leaderUserId: team.leaderUserId ?? "",
        leaderUserName: team.leader?.name ?? "未設定",
        memberCount: team.memberships.length,
        memberNames: team.memberships.map((membership) => membership.user.name),
        isActive: team.isActive,
      })),
      leaderOptions: leaders.map((leader) => ({ userId: leader.id, userName: leader.name })),
      unassignedMembers: unassignedUsers.map((user) => ({
        userId: user.id,
        userName: user.name,
        departmentId: user.department?.id ?? "",
        departmentName: user.department?.name ?? "未設定",
      })),
      source: "database",
    };
  } catch {
    return fallbackBundle;
  }
}

export async function saveOrganizationStructure(input: SaveOrganizationInput) {
  if (!hasDatabaseUrl()) {
    return { success: true as const, source: "fallback" as const };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const department of input.departments) {
        const name = department.name.trim();
        if (!name) continue;

        if (department.id) {
          await tx.department.update({
            where: { id: department.id },
            data: { name },
          });
        } else {
          await tx.department.create({
            data: { name },
          });
        }
      }

      for (const team of input.teams) {
        const name = team.name.trim();
        if (!name) continue;

        const data = {
          name,
          departmentId: team.departmentId?.trim() || null,
          leaderUserId: team.leaderUserId?.trim() || null,
          isActive: Boolean(team.isActive),
        };

        if (team.id) {
          await tx.team.update({
            where: { id: team.id },
            data,
          });
        } else {
          await tx.team.create({
            data,
          });
        }
      }
    });

    return { success: true as const, source: "database" as const };
  } catch {
    return { success: true as const, source: "fallback" as const };
  }
}
