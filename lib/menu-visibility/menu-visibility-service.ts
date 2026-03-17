import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AppRole } from "@/lib/permissions/definitions";

const settingsFilePath = path.join(process.cwd(), "data", "settings", "user-menu-visibility.json");

export type UserMenuVisibility = {
  philosophyPractice: boolean;
  monthlyReport: boolean;
  salaryStatement: boolean;
  expenseSettlement: boolean;
};

type StoredMenuVisibility = Partial<UserMenuVisibility>;

type UserMenuVisibilityFile = {
  users?: Record<string, StoredMenuVisibility>;
};

const defaultMenuVisibility: UserMenuVisibility = {
  philosophyPractice: true,
  monthlyReport: false,
  salaryStatement: false,
  expenseSettlement: false,
};

function sanitizeMenuVisibility(input?: StoredMenuVisibility | null): UserMenuVisibility {
  return {
    philosophyPractice: input?.philosophyPractice ?? defaultMenuVisibility.philosophyPractice,
    monthlyReport: input?.monthlyReport ?? defaultMenuVisibility.monthlyReport,
    salaryStatement: input?.salaryStatement ?? defaultMenuVisibility.salaryStatement,
    expenseSettlement: input?.expenseSettlement ?? defaultMenuVisibility.expenseSettlement,
  };
}

async function readVisibilityFile(): Promise<UserMenuVisibilityFile> {
  try {
    const raw = await readFile(settingsFilePath, "utf8");
    return JSON.parse(raw) as UserMenuVisibilityFile;
  } catch {
    return { users: {} };
  }
}

export async function getUserMenuVisibilityMap(userIds: string[]): Promise<Record<string, UserMenuVisibility>> {
  const file = await readVisibilityFile();
  const result: Record<string, UserMenuVisibility> = {};

  for (const userId of userIds) {
    result[userId] = sanitizeMenuVisibility(file.users?.[userId]);
  }

  return result;
}

export async function getUserMenuVisibility(userId: string, role?: AppRole): Promise<UserMenuVisibility> {
  void role;
  const map = await getUserMenuVisibilityMap([userId]);
  return map[userId] ?? defaultMenuVisibility;
}

export async function saveUserMenuVisibilityMap(input: Record<string, StoredMenuVisibility>): Promise<Record<string, UserMenuVisibility>> {
  const current = await readVisibilityFile();
  const mergedUsers: Record<string, StoredMenuVisibility> = {
    ...(current.users ?? {}),
  };

  for (const [userId, visibility] of Object.entries(input)) {
    mergedUsers[userId] = sanitizeMenuVisibility(visibility);
  }

  await mkdir(path.dirname(settingsFilePath), { recursive: true });
  await writeFile(
    settingsFilePath,
    `${JSON.stringify({ users: mergedUsers }, null, 2)}\n`,
    "utf8",
  );

  const result: Record<string, UserMenuVisibility> = {};
  for (const [userId, visibility] of Object.entries(mergedUsers)) {
    result[userId] = sanitizeMenuVisibility(visibility);
  }

  return result;
}

export async function isUserMenuEnabled(userId: string, menuKey: keyof UserMenuVisibility, role?: AppRole) {
  const visibility = await getUserMenuVisibility(userId, role);
  return visibility[menuKey];
}
