import { Prisma, UserStatus } from "@/generated/prisma";
import { SAMPLE_LOGIN_PASSWORD, createPasswordHash, verifyPassword } from "@/lib/auth/password";
import type { UserMenuVisibility } from "@/lib/menu-visibility/menu-visibility-service";
import { getUserMenuVisibilityMap, saveUserMenuVisibilityMap } from "@/lib/menu-visibility/menu-visibility-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

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

export type UserMembershipHistoryRow = {
  membershipId: string;
  teamId: string;
  departmentName: string;
  teamName: string;
  startDate: string;
  endDate: string;
  startDateValue: string;
  endDateValue: string;
  isPrimary: boolean;
};

export type UserManagementBundle = {
  rows: UserManagementRow[];
  roleOptions: UserRoleOption[];
  departmentOptions: UserDepartmentOption[];
  teamOptions: UserTeamOption[];
  membershipHistoryMap: Record<string, UserMembershipHistoryRow[]>;
  source: "database" | "fallback";
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateInput(date: Date | null) {
  if (!date) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    { roleId: "role-president", roleCode: "president", roleName: "役員" },
  ],
  departmentOptions: [
    { departmentId: "dept-dev", departmentName: "開発本部" },
    { departmentId: "dept-sales", departmentName: "営業本部" },
  ],
  teamOptions: [
    { teamId: "team-platform", teamName: "プラットフォームチーム", departmentId: "dept-dev" },
    { teamId: "team-solution", teamName: "ソリューションチーム", departmentId: "dept-dev" },
  ],
  membershipHistoryMap: {
    "demo-admin": [
      {
        membershipId: "membership-demo-admin",
        teamId: "team-platform",
        departmentName: "開発本部",
        teamName: "プラットフォームチーム",
        startDate: "2024/04/01",
        endDate: "現在",
        startDateValue: "2024-04-01",
        endDateValue: "",
        isPrimary: true,
      },
    ],
  },
  source: "fallback",
};

export async function getUserManagementBundle(): Promise<UserManagementBundle> {
  if (!hasDatabaseUrl()) {
    return fallbackBundle;
  }

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
            orderBy: { startDate: "desc" },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              isPrimary: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  department: { select: { id: true, name: true } },
                },
              },
            },
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
      rows: users.map((user) => {
        const currentPrimaryMembership = user.teamMemberships.find((membership) => membership.isPrimary && !membership.endDate);

        return {
          userId: user.id,
          employeeCode: user.employeeCode,
          name: user.name,
          email: user.email,
          joinedAt: formatDate(user.joinedAt),
          roleId: user.role.id,
          roleCode: user.role.code,
          roleName: user.role.name,
          departmentId: currentPrimaryMembership?.team.department?.id ?? "",
          departmentName: currentPrimaryMembership?.team.department?.name ?? "-",
          teamId: currentPrimaryMembership?.team.id ?? "",
          teamName: currentPrimaryMembership?.team.name ?? "未所属",
          status: user.status,
          menuVisibility: menuVisibilityMap[user.id],
        };
      }),
      roleOptions: roles.map((role) => ({ roleId: role.id, roleCode: role.code, roleName: role.name })),
      departmentOptions: departments.map((department) => ({
        departmentId: department.id,
        departmentName: department.name,
      })),
      teamOptions: teams.map((team) => ({ teamId: team.id, teamName: team.name, departmentId: team.departmentId ?? "" })),
      membershipHistoryMap: Object.fromEntries(
        users.map((user) => [
          user.id,
          user.teamMemberships.map((membership) => ({
            membershipId: membership.id,
            teamId: membership.team.id,
            departmentName: membership.team.department?.name ?? "-",
            teamName: membership.team.name,
            startDate: formatDate(membership.startDate),
            endDate: membership.endDate ? formatDate(membership.endDate) : "現在",
            startDateValue: formatDateInput(membership.startDate),
            endDateValue: formatDateInput(membership.endDate),
            isPrimary: membership.isPrimary,
          })),
        ]),
      ),
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

export async function changeOwnPassword(input: { userId: string; currentPassword: string; newPassword: string }) {
  if (!input.currentPassword || !input.newPassword) {
    throw new Error("現在のパスワードと新しいパスワードを入力してください。");
  }

  if (input.currentPassword === input.newPassword) {
    throw new Error("新しいパスワードは現在のパスワードと別のものを指定してください。");
  }

  if (!hasDatabaseUrl()) {
    if (input.currentPassword !== SAMPLE_LOGIN_PASSWORD) {
      throw new Error("現在のパスワードが正しくありません。");
    }

    return { success: true as const, source: "fallback" as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    throw new Error("ユーザーが見つかりません。");
  }

  if (!verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new Error("現在のパスワードが正しくありません。");
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash: createPasswordHash(input.newPassword) },
  });

  return { success: true as const, source: "database" as const };
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

export async function assignUserToTeam(input: { userId: string; teamId: string; startDate: string }) {
  const membershipStartDate = new Date(`${input.startDate}T00:00:00`);
  const previousEndDate = new Date(membershipStartDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);

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
            endDate: previousEndDate,
          },
        });
      }

      await tx.teamMembership.create({
        data: {
          teamId: input.teamId,
          userId: input.userId,
          startDate: membershipStartDate,
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
  joinedAt: string;
  membershipStartDate?: string;
  password: string;
}) {
  const passwordHash = createPasswordHash(input.password);
  const joinedAt = new Date(`${input.joinedAt}T00:00:00`);
  const membershipStartDate = new Date(`${(input.membershipStartDate || input.joinedAt)}T00:00:00`);

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
          joinedAt,
          status: UserStatus.ACTIVE,
        },
      });

      if (input.teamId) {
        await tx.teamMembership.create({
          data: {
            userId: createdUser.id,
            teamId: input.teamId,
            startDate: membershipStartDate,
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

async function syncUserDepartmentFromActiveMembership(tx: Prisma.TransactionClient, userId: string) {
  const today = new Date();
  const activeMembership = await tx.teamMembership.findFirst({
    where: {
      userId,
      isPrimary: true,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    },
    orderBy: { startDate: "desc" },
    select: { team: { select: { departmentId: true } } },
  });

  await tx.user.update({
    where: { id: userId },
    data: { departmentId: activeMembership?.team.departmentId ?? null },
  });
}

export async function updateMembershipHistory(input: { membershipId: string; startDate: string; endDate?: string }) {
  const startDate = new Date(`${input.startDate}T00:00:00`);
  const endDate = input.endDate ? new Date(`${input.endDate}T00:00:00`) : null;

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("所属開始日が不正です。");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error("所属終了日が不正です。");
  }

  if (endDate && endDate < startDate) {
    throw new Error("所属終了日は所属開始日以降を指定してください。");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const membership = await tx.teamMembership.findUnique({
        where: { id: input.membershipId },
        select: { id: true, userId: true },
      });

      if (!membership) {
        throw new Error("所属履歴が見つかりません。");
      }

      await tx.teamMembership.update({
        where: { id: input.membershipId },
        data: { startDate, endDate },
      });

      await syncUserDepartmentFromActiveMembership(tx, membership.userId);
    });

    return { success: true as const, source: "database" as const };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return { success: true as const, source: "fallback" as const };
  }
}
