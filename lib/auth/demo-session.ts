import { cookies, headers } from "next/headers";

import { verifyPassword } from "@/lib/auth/password";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/permissions/definitions";
import type { SessionUser } from "@/lib/permissions/check";

export const SESSION_COOKIE_NAME = "evaluation_session_user_id";

const demoUsers: Record<AppRole, SessionUser> = {
  employee: {
    id: "demo-employee",
    name: "開発 一郎",
    role: "employee",
    teamIds: ["team-platform"],
  },
  leader: {
    id: "demo-leader",
    name: "主任 次郎",
    role: "leader",
    teamIds: ["team-platform"],
  },
  admin: {
    id: "demo-admin",
    name: "管理 花子",
    role: "admin",
    teamIds: ["team-platform"],
  },
  president: {
    id: "demo-president",
    name: "代表 太郎",
    role: "president",
    teamIds: [],
  },
};

const demoLoginUsers: Array<{ userId: string; employeeCode: string; password: string; name: string; role: AppRole; teamName: string }> = [
  { userId: "demo-president", employeeCode: "DEMO-1", password: "password", name: "代表 太郎", role: "president", teamName: "全社" },
  { userId: "demo-admin", employeeCode: "DEMO-2", password: "password", name: "管理 花子", role: "admin", teamName: "プラットフォームチーム" },
  { userId: "demo-leader", employeeCode: "DEMO-3", password: "password", name: "主任 次郎", role: "leader", teamName: "プラットフォームチーム" },
  { userId: "demo-employee", employeeCode: "DEMO-4", password: "password", name: "開発 一郎", role: "employee", teamName: "プラットフォームチーム" },
];

export type LoginUserOption = {
  id: string;
  employeeCode: string;
  name: string;
  role: AppRole;
  teamName: string;
};

export type ResolvedLoginTarget = {
  userId: string;
  redirectTo: string;
};

async function mapUserToSessionUser(userId: string): Promise<SessionUser | null> {
  if (userId in demoUsers) {
    return demoUsers[userId as AppRole] ?? Object.values(demoUsers).find((user) => user.id === userId) ?? null;
  }

  if (!hasDatabaseUrl()) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        status: true,
        role: { select: { code: true } },
        teamMemberships: {
          where: { endDate: null },
          select: { teamId: true },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role.code as AppRole,
      teamIds: user.teamMemberships.map((membership) => membership.teamId),
    };
  } catch {
    return null;
  }
}

async function getFallbackDatabaseUser(): Promise<SessionUser | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  try {
    const user = await prisma.user.findFirst({
      where: { status: "ACTIVE" },
      orderBy: [{ employeeCode: "asc" }],
      select: {
        id: true,
        name: true,
        role: { select: { code: true } },
        teamMemberships: {
          where: { endDate: null },
          select: { teamId: true },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role.code as AppRole,
      teamIds: user.teamMemberships.map((membership) => membership.teamId),
    };
  } catch {
    return null;
  }
}

async function findActiveLoginUser(where: { id?: string; employeeCode?: string }) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      ...(where.id ? { id: where.id } : {}),
      ...(where.employeeCode ? { employeeCode: where.employeeCode } : {}),
    },
    select: {
      id: true,
      passwordHash: true,
      role: { select: { code: true } },
    },
  });
}

function getDefaultRedirect() {
  return "/menu";
}

function getDemoUserById(userId: string) {
  return demoLoginUsers.find((user) => user.userId === userId) ?? null;
}

function getDemoUserByEmployeeCode(employeeCode: string) {
  return demoLoginUsers.find((user) => user.employeeCode === employeeCode) ?? null;
}

export async function getLoginUserOptions(): Promise<LoginUserOption[]> {
  if (!hasDatabaseUrl()) {
    return demoLoginUsers.map((user) => ({
      id: user.userId,
      employeeCode: user.employeeCode,
      name: user.name,
      role: user.role,
      teamName: user.teamName,
    }));
  }

  try {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ employeeCode: "asc" }],
      select: {
        id: true,
        employeeCode: true,
        name: true,
        role: { select: { code: true } },
        teamMemberships: {
          where: { isPrimary: true },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { team: { select: { name: true } } },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      employeeCode: user.employeeCode,
      name: user.name,
      role: user.role.code as AppRole,
      teamName: user.teamMemberships[0]?.team.name ?? "未所属",
    }));
  } catch {
    return demoLoginUsers.map((user) => ({
      id: user.userId,
      employeeCode: user.employeeCode,
      name: user.name,
      role: user.role,
      teamName: user.teamName,
    }));
  }
}

export async function resolveSelectedLoginTarget(input: { userId?: string; redirectTo?: string }): Promise<ResolvedLoginTarget | null> {
  const userId = input.userId?.trim();
  if (!userId) {
    return null;
  }

  const demoUser = getDemoUserById(userId);
  if (demoUser) {
    return {
      userId: demoUser.userId,
      redirectTo: input.redirectTo?.trim() || getDefaultRedirect(),
    };
  }

  try {
    const user = await findActiveLoginUser({ id: userId });
    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      redirectTo: input.redirectTo?.trim() || getDefaultRedirect(),
    };
  } catch {
    return null;
  }
}

export async function resolveCredentialLoginTarget(input: {
  employeeCode?: string;
  password?: string;
  redirectTo?: string;
}): Promise<ResolvedLoginTarget | null> {
  const employeeCode = input.employeeCode?.trim();
  const password = input.password ?? "";

  if (!employeeCode || !password) {
    return null;
  }

  const demoUser = getDemoUserByEmployeeCode(employeeCode);
  if (demoUser && demoUser.password === password) {
    return {
      userId: demoUser.userId,
      redirectTo: input.redirectTo?.trim() || getDefaultRedirect(),
    };
  }

  try {
    const user = await findActiveLoginUser({ employeeCode });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return null;
    }

    return {
      userId: user.id,
      redirectTo: input.redirectTo?.trim() || getDefaultRedirect(),
    };
  } catch {
    return null;
  }
}

export async function isLoginUserIdValid(userId: string): Promise<boolean> {
  const user = await mapUserToSessionUser(userId);
  return Boolean(user);
}

export async function getSessionUser(): Promise<SessionUser> {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionUserId) {
    const sessionUser = await mapUserToSessionUser(sessionUserId);
    if (sessionUser) {
      return sessionUser;
    }
  }

  const headerStore = await headers();
  const requestedRole = headerStore.get("x-demo-role") as AppRole | null;

  if (requestedRole && requestedRole in demoUsers) {
    return demoUsers[requestedRole];
  }

  return (await getFallbackDatabaseUser()) ?? demoUsers.admin;
}
