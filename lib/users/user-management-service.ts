import { UserStatus } from "@/generated/prisma";
import { createPasswordHash } from "@/lib/auth/password";
import type { UserMenuVisibility } from "@/lib/menu-visibility/menu-visibility-service";
import { getUserMenuVisibilityMap, saveUserMenuVisibilityMap } from "@/lib/menu-visibility/menu-visibility-service";
import { prisma } from "@/lib/prisma";

export type UserManagementRow = {
  userId: string;
  employeeCode: string;
  name: string;
  email: string;
  joinedAt: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  departmentId: string;
  departmentName: string;
  teamId: string;
  teamName: string;
  status: string;
  menuVisibility: UserMenuVisibility;
};

export type UserRoleOption = {
  roleId: string;
  roleCode: string;
  roleName: string;
};

export type UserDepartmentOption = {
  departmentId: string;
  departmentName: string;
};

export type UserTeamOption = {
  teamId: string;
  teamName: string;
  departmentId: string;
};

export type UserManagementBundle = {
  rows: UserManagementRow[];
  roleOptions: UserRoleOption[];
  departmentOptions: UserDepartmentOption[];
  teamOptions: UserTeamOption[];
  source: "database" | "fallback";
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const fallbackBundle: UserManagementBundle = {
  rows: [
    {
      userId: "demo-admin",
      employeeCode: "E0002",
      name: "管理 花子",
      email: "admin@example.com",
      joinedAt: "2024/04/01",
      roleId: "role-admin",
      roleCode: "admin",
      roleName: "管理者",
      departmentId: "dept-dev",
      departmentName: "開発本部",
      teamId: "team-platform",
      teamName: "プラットフォームチーム",
      status: "ACTIVE",
      menuVisibility: {
        philosophyPractice: true,
        monthlyReport: false,
        salaryStatement: false,
        expenseSettlement: false,
      },
    },
  ],
  roleOptions: [
    { roleId: "role-employee", roleCode: "employee", roleName: "社員" },
    { roleId: "role-leader", roleCode: "leader", roleName: "リーダー" },
    { roleId: "role-admin", roleCode: "admin", roleName: "管理者" },
    { roleId: "role-president", roleCode: "president", roleName: "社長" },
  ],
  departmentOptions: [
    { departmentId: "dept-dev", departmentName: "開発本部" },
    { departmentId: "dept-sales", departmentName: "営業本部" },
  ],
  teamOptions: [
    { teamId: "team-platform", teamName: "プラットフォームチーム", departmentId: "dept-dev" },
    { teamId: "team-solution", teamName: "ソリューションチーム", departmentId: "dept-dev" },
  ],
  source: "fallback",
};

export async function getUserManagementBundle(): Promise<UserManagementBundle> {
  try {
    const [users, roles, departments, teams] = await Promise.all([
      prisma.user.findMany({
        orderBy: [{ employeeCode: "asc" }],
        select: {
          id: true,
          employeeCode: true,
          name: true,
          email: true,
          joinedAt: true,
          status: true,
          role: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, name: true } },
          teamMemberships: {
            where: { isPrimary: true },
            orderBy: { startDate: "desc" },
            take: 1,
            select: { team: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.role.findMany({
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.department.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.team.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, departmentId: true },
      }),
    ]);

    const menuVisibilityMap = await getUserMenuVisibilityMap(users.map((user) => user.id));

    return {
      rows: users.map((user) => ({
        userId: user.id,
        employeeCode: user.employeeCode,
        name: user.name,
        email: user.email,
        joinedAt: formatDate(user.joinedAt),
        roleId: user.role.id,
        roleCode: user.role.code,
        roleName: user.role.name,
        departmentId: user.department?.id ?? "",
        departmentName: user.department?.name ?? "-",
        teamId: user.teamMemberships[0]?.team.id ?? "",
        teamName: user.teamMemberships[0]?.team.name ?? "未所属",
        status: user.status,
        menuVisibility: menuVisibilityMap[user.id],
      })),
      roleOptions: roles.map((role) => ({ roleId: role.id, roleCode: role.code, roleName: role.name })),
      departmentOptions: departments.map((department) => ({
        departmentId: department.id,
        departmentName: department.name,
      })),
      teamOptions: teams.map((team) => ({ teamId: team.id, teamName: team.name, departmentId: team.departmentId ?? "" })),
      source: "database",
    };
  } catch {
    return fallbackBundle;
  }
}

export async function updateUserPassword(input: { userId: string; password: string }) {
  const passwordHash = createPasswordHash(input.password);
  try {
    await prisma.user.update({
      where: { id: input.userId },
      data: { passwordHash },
    });
    return { success: true as const, source: "database" as const };
  } catch {
    return { success: true as const, source: "fallback" as const };
  }
}

export async function updateUserProfile(input: {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  status: UserStatus;
  departmentId?: string;
  teamId?: string;
  menuVisibility?: UserMenuVisibility;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          name: input.name,
          email: input.email,
          roleId: input.roleId,
          status: input.status,
          departmentId: input.departmentId || null,
        },
      });

      const currentMembership = await tx.teamMembership.findFirst({
        where: {
          userId: input.userId,
          isPrimary: true,
        },
        orderBy: { startDate: "desc" },
      });

      if (input.status === UserStatus.INACTIVE || !input.teamId) {
        if (currentMembership) {
          await tx.teamMembership.update({
            where: { id: currentMembership.id },
            data: {
              isPrimary: false,
              endDate: new Date(),
            },
          });
        }
        return;
      }

      if (currentMembership?.teamId === input.teamId) {
        return;
      }

      if (currentMembership) {
        await tx.teamMembership.update({
          where: { id: currentMembership.id },
          data: {
            isPrimary: false,
            endDate: new Date(),
          },
        });
      }

      await tx.teamMembership.create({
        data: {
          teamId: input.teamId,
          userId: input.userId,
          startDate: new Date(),
          isPrimary: true,
        },
      });
    });

    if (input.menuVisibility) {
      await saveUserMenuVisibilityMap({
        [input.userId]: input.menuVisibility,
      });
    }

    return { success: true as const, source: "database" as const };
  } catch {
    if (input.menuVisibility) {
      await saveUserMenuVisibilityMap({
        [input.userId]: input.menuVisibility,
      });
    }
    return { success: true as const, source: "fallback" as const };
  }
}

export async function assignUserToTeam(input: { userId: string; teamId: string }) {
  try {
    await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: input.teamId },
        select: { id: true, departmentId: true, isActive: true },
      });

      if (!team || !team.isActive) {
        throw new Error("対象チームが見つからないか、無効です");
      }

      await tx.user.update({
        where: { id: input.userId },
        data: {
          departmentId: team.departmentId ?? null,
          status: UserStatus.ACTIVE,
        },
      });

      const currentMembership = await tx.teamMembership.findFirst({
        where: {
          userId: input.userId,
          isPrimary: true,
        },
        orderBy: { startDate: "desc" },
      });

      if (currentMembership?.teamId === input.teamId) {
        return;
      }

      if (currentMembership) {
        await tx.teamMembership.update({
          where: { id: currentMembership.id },
          data: {
            isPrimary: false,
            endDate: new Date(),
          },
        });
      }

      await tx.teamMembership.create({
        data: {
          teamId: input.teamId,
          userId: input.userId,
          startDate: new Date(),
          isPrimary: true,
        },
      });
    });

    return { success: true as const, source: "database" as const };
  } catch {
    return { success: true as const, source: "fallback" as const };
  }
}

export async function createUser(input: {
  employeeCode: string;
  name: string;
  email: string;
  roleId: string;
  departmentId?: string;
  teamId?: string;
  password: string;
}) {
  const passwordHash = createPasswordHash(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          employeeCode: input.employeeCode,
          name: input.name,
          email: input.email,
          passwordHash,
          roleId: input.roleId,
          departmentId: input.departmentId || null,
          joinedAt: new Date(),
          status: UserStatus.ACTIVE,
        },
      });

      if (input.teamId) {
        await tx.teamMembership.create({
          data: {
            userId: createdUser.id,
            teamId: input.teamId,
            startDate: new Date(),
            isPrimary: true,
          },
        });
      }

      return createdUser;
    });

    return { success: true as const, source: "database" as const, userId: user.id };
  } catch {
    return { success: true as const, source: "fallback" as const, userId: `fallback-${input.employeeCode}` };
  }
}
