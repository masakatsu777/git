import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@/generated/prisma";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/permissions/definitions";
import type { SessionUser } from "@/lib/permissions/check";

const monthlyReportFilePath = path.join(process.cwd(), "data", "monthly-reports.json");

export type MemberType = "leader" | "member";

export type TeamReportFields = {
  projectSummary: string;
  teamSelfGrowthIssue: string;
  teamSelfGrowthResult: string;
  teamSynergyIssue: string;
  teamSynergyResult: string;
};

export type PersonalReportFields = {
  projectRole: string;
  personalSelfGrowthIssue: string;
  personalSelfGrowthResult: string;
  personalSynergyIssue: string;
  personalSynergyResult: string;
};

export type ProjectOption = {
  projectId: string;
  projectName: string;
  teamId: string | null;
  teamName: string;
};

export type MonthlyReportViewer = {
  userId: string;
  name: string;
  role: AppRole;
  teamId: string | null;
  teamName: string;
  memberType: MemberType;
};

export type MonthlyReportEditorBundle = {
  currentYearMonth: string;
  previousYearMonth: string;
  viewer: MonthlyReportViewer;
  projectOptions: ProjectOption[];
  selectedProjectId: string;
  selectedProjectName: string;
  teamReport: TeamReportFields | null;
  personalReport: PersonalReportFields;
  previousState: {
    hasTeamReport: boolean;
    hasPersonalReport: boolean;
  };
  permissions: {
    canEditTeamReport: boolean;
    canEditPersonalReport: boolean;
  };
  source: "database" | "file";
};

export type MonthlyReportMemberRow = {
  userId: string;
  userName: string;
  userRole: AppRole;
  memberType: MemberType;
  projectRole: string;
  personalReport: PersonalReportFields;
  updatedAt: string;
  canEdit: boolean;
};

export type MonthlyReportGroupRow = {
  key: string;
  yearMonth: string;
  projectId: string;
  projectName: string;
  teamId: string | null;
  teamName: string;
  teamReport: TeamReportFields | null;
  members: MonthlyReportMemberRow[];
};

export type MonthlyReportListFilters = {
  yearMonth?: string;
  projectKeyword?: string;
  teamKeyword?: string;
  userKeyword?: string;
};

export type MonthlyReportListBundle = {
  filters: Required<MonthlyReportListFilters>;
  groups: MonthlyReportGroupRow[];
  source: "database" | "file";
};

export type SaveMonthlyReportInput = {
  yearMonth: string;
  projectId?: string;
  projectName?: string;
  teamReport?: TeamReportFields;
  personalReport: PersonalReportFields;
};

type StoredProject = {
  id: string;
  name: string;
  teamId: string | null;
  teamName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

type StoredTeamReport = TeamReportFields & {
  id: string;
  yearMonth: string;
  projectId: string;
  teamId: string;
  teamName: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

type StoredPersonalReport = PersonalReportFields & {
  id: string;
  yearMonth: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  userRole: AppRole;
  memberType: MemberType;
  teamId: string | null;
  teamName: string;
  createdAt: string;
  updatedAt: string;
};

type MonthlyReportFile = {
  projects?: StoredProject[];
  teamReports?: StoredTeamReport[];
  personalReports?: StoredPersonalReport[];
};

type UserProfile = {
  userId: string;
  name: string;
  role: AppRole;
  teamId: string | null;
  teamName: string;
};

const demoProfiles: Record<string, UserProfile> = {
  "demo-employee": {
    userId: "demo-employee",
    name: "開発 一郎",
    role: "employee",
    teamId: "team-platform",
    teamName: "プラットフォームチーム",
  },
  "demo-leader": {
    userId: "demo-leader",
    name: "主任 次郎",
    role: "leader",
    teamId: "team-platform",
    teamName: "プラットフォームチーム",
  },
  "demo-admin": {
    userId: "demo-admin",
    name: "管理 花子",
    role: "admin",
    teamId: "team-platform",
    teamName: "プラットフォームチーム",
  },
  "demo-president": {
    userId: "demo-president",
    name: "代表 太郎",
    role: "president",
    teamId: null,
    teamName: "個人",
  },
};

function getCurrentYearMonth() {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function isValidYearMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function getPreviousYearMonth(yearMonth: string) {
  if (!isValidYearMonth(yearMonth)) {
    return getCurrentYearMonth();
  }

  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

function sanitizeText(value: string) {
  return value.trim();
}

function normalize(value: string) {
  return sanitizeText(value).toLowerCase();
}

function toMemberType(role: AppRole): MemberType {
  return role === "leader" ? "leader" : "member";
}

function sanitizeMemberType(value: string, role: AppRole): MemberType {
  return value === "leader" ? "leader" : toMemberType(role);
}

function displayTeamName(teamName?: string | null) {
  return sanitizeText(String(teamName ?? "")) || "個人";
}

function sanitizeRole(value: string): AppRole {
  return value === "leader" || value === "admin" || value === "president" ? value : "employee";
}

function sanitizeTeamReport(input?: Partial<TeamReportFields> | null): TeamReportFields {
  return {
    projectSummary: sanitizeText(String(input?.projectSummary ?? "")),
    teamSelfGrowthIssue: sanitizeText(String(input?.teamSelfGrowthIssue ?? "")),
    teamSelfGrowthResult: sanitizeText(String(input?.teamSelfGrowthResult ?? "")),
    teamSynergyIssue: sanitizeText(String(input?.teamSynergyIssue ?? "")),
    teamSynergyResult: sanitizeText(String(input?.teamSynergyResult ?? "")),
  };
}

function sanitizePersonalReport(input?: Partial<PersonalReportFields> | null): PersonalReportFields {
  return {
    projectRole: sanitizeText(String(input?.projectRole ?? "")),
    personalSelfGrowthIssue: sanitizeText(String(input?.personalSelfGrowthIssue ?? "")),
    personalSelfGrowthResult: sanitizeText(String(input?.personalSelfGrowthResult ?? "")),
    personalSynergyIssue: sanitizeText(String(input?.personalSynergyIssue ?? "")),
    personalSynergyResult: sanitizeText(String(input?.personalSynergyResult ?? "")),
  };
}

function sanitizeProject(input: Partial<StoredProject>): StoredProject | null {
  const id = sanitizeText(String(input.id ?? ""));
  const name = sanitizeText(String(input.name ?? ""));

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    teamId: input.teamId ? sanitizeText(String(input.teamId)) : null,
    teamName: displayTeamName(input.teamName),
    createdBy: sanitizeText(String(input.createdBy ?? "")),
    createdAt: String(input.createdAt ?? new Date().toISOString()),
    updatedAt: String(input.updatedAt ?? new Date().toISOString()),
    isActive: input.isActive !== false,
  };
}

function sanitizeTeamReportRow(input: Partial<StoredTeamReport>): StoredTeamReport | null {
  const id = sanitizeText(String(input.id ?? ""));
  const yearMonth = sanitizeText(String(input.yearMonth ?? ""));
  const projectId = sanitizeText(String(input.projectId ?? ""));
  const teamId = sanitizeText(String(input.teamId ?? ""));

  if (!id || !projectId || !teamId || !isValidYearMonth(yearMonth)) {
    return null;
  }

  return {
    id,
    yearMonth,
    projectId,
    teamId,
    teamName: displayTeamName(input.teamName),
    updatedBy: sanitizeText(String(input.updatedBy ?? "")),
    createdAt: String(input.createdAt ?? new Date().toISOString()),
    updatedAt: String(input.updatedAt ?? new Date().toISOString()),
    ...sanitizeTeamReport(input),
  };
}

function sanitizePersonalReportRow(input: Partial<StoredPersonalReport>): StoredPersonalReport | null {
  const id = sanitizeText(String(input.id ?? ""));
  const yearMonth = sanitizeText(String(input.yearMonth ?? ""));
  const projectId = sanitizeText(String(input.projectId ?? ""));
  const projectName = sanitizeText(String(input.projectName ?? ""));
  const userId = sanitizeText(String(input.userId ?? ""));
  const userName = sanitizeText(String(input.userName ?? ""));
  const userRole = sanitizeRole(String(input.userRole ?? "employee"));

  if (!id || !projectId || !projectName || !userId || !userName || !isValidYearMonth(yearMonth)) {
    return null;
  }

  return {
    id,
    yearMonth,
    projectId,
    projectName,
    userId,
    userName,
    userRole,
    memberType: sanitizeMemberType(String(input.memberType ?? "member"), userRole),
    teamId: input.teamId ? sanitizeText(String(input.teamId)) : null,
    teamName: displayTeamName(input.teamName),
    createdAt: String(input.createdAt ?? new Date().toISOString()),
    updatedAt: String(input.updatedAt ?? new Date().toISOString()),
    ...sanitizePersonalReport(input),
  };
}

async function readMonthlyReportFile(): Promise<{
  projects: StoredProject[];
  teamReports: StoredTeamReport[];
  personalReports: StoredPersonalReport[];
}> {
  try {
    const raw = await readFile(monthlyReportFilePath, "utf8");
    const parsed = JSON.parse(raw) as MonthlyReportFile;
    return {
      projects: (parsed.projects ?? []).map((row) => sanitizeProject(row)).filter((row): row is StoredProject => Boolean(row)),
      teamReports: (parsed.teamReports ?? []).map((row) => sanitizeTeamReportRow(row)).filter((row): row is StoredTeamReport => Boolean(row)),
      personalReports: (parsed.personalReports ?? []).map((row) => sanitizePersonalReportRow(row)).filter((row): row is StoredPersonalReport => Boolean(row)),
    };
  } catch {
    return {
      projects: [],
      teamReports: [],
      personalReports: [],
    };
  }
}

async function writeMonthlyReportFile(data: {
  projects: StoredProject[];
  teamReports: StoredTeamReport[];
  personalReports: StoredPersonalReport[];
}) {
  await mkdir(path.dirname(monthlyReportFilePath), { recursive: true });
  await writeFile(monthlyReportFilePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function resolveUserProfile(sessionUser: SessionUser): Promise<UserProfile> {
  const demoProfile = demoProfiles[sessionUser.id];
  if (demoProfile) {
    return demoProfile;
  }

  if (!hasDatabaseUrl()) {
    return {
      userId: sessionUser.id,
      name: sessionUser.name,
      role: sessionUser.role,
      teamId: sessionUser.teamIds[0] ?? null,
      teamName: sessionUser.teamIds[0] ? sessionUser.teamIds[0] : "個人",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        role: { select: { code: true } },
        teamMemberships: {
          where: {
            isPrimary: true,
            endDate: null,
          },
          orderBy: { startDate: "desc" },
          take: 1,
          select: {
            teamId: true,
            team: { select: { name: true } },
          },
        },
      },
    });

    if (!user) {
      return {
        userId: sessionUser.id,
        name: sessionUser.name,
        role: sessionUser.role,
        teamId: sessionUser.teamIds[0] ?? null,
        teamName: displayTeamName(null),
      };
    }

    const membership = user.teamMemberships[0];
    return {
      userId: user.id,
      name: user.name,
      role: sanitizeRole(user.role.code),
      teamId: membership?.teamId ?? null,
      teamName: displayTeamName(membership?.team.name),
    };
  } catch {
    return {
      userId: sessionUser.id,
      name: sessionUser.name,
      role: sessionUser.role,
      teamId: sessionUser.teamIds[0] ?? null,
      teamName: displayTeamName(null),
    };
  }
}

function canEditTeamReport(user: MonthlyReportViewer) {
  return user.role === "leader" || user.role === "admin";
}

function toViewer(profile: UserProfile): MonthlyReportViewer {
  return {
    userId: profile.userId,
    name: profile.name,
    role: profile.role,
    teamId: profile.teamId,
    teamName: displayTeamName(profile.teamName),
    memberType: toMemberType(profile.role),
  };
}

function buildGroupKey(yearMonth: string, projectId: string, teamName: string) {
  return `${yearMonth}:${projectId}:${teamName}`;
}

function sortProjectOptions(projects: ProjectOption[], viewer: MonthlyReportViewer) {
  return [...projects].sort((left, right) => {
    const leftOwnTeam = left.teamId && viewer.teamId && left.teamId === viewer.teamId ? 0 : 1;
    const rightOwnTeam = right.teamId && viewer.teamId && right.teamId === viewer.teamId ? 0 : 1;
    return leftOwnTeam - rightOwnTeam
      || left.projectName.localeCompare(right.projectName, "ja")
      || left.teamName.localeCompare(right.teamName, "ja");
  });
}

async function getProjectOptionsFromDb(viewer: MonthlyReportViewer): Promise<ProjectOption[]> {
  const rows = await prisma.monthlyReportProject.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }, { teamNameSnapshot: "asc" }],
    select: {
      id: true,
      name: true,
      teamId: true,
      teamNameSnapshot: true,
      team: { select: { name: true } },
    },
  });

  return sortProjectOptions(rows.map((row) => ({
    projectId: row.id,
    projectName: row.name,
    teamId: row.teamId,
    teamName: displayTeamName(row.team?.name ?? row.teamNameSnapshot),
  })), viewer);
}

function getProjectOptionsFromFile(projects: StoredProject[], viewer: MonthlyReportViewer): ProjectOption[] {
  return sortProjectOptions(
    projects.filter((project) => project.isActive).map((project) => ({
      projectId: project.id,
      projectName: project.name,
      teamId: project.teamId,
      teamName: displayTeamName(project.teamName),
    })),
    viewer,
  );
}

type TeamReportRecord = {
  projectSummary: string;
  teamSelfGrowthIssue: string;
  teamSelfGrowthResult: string;
  teamSynergyIssue: string;
  teamSynergyResult: string;
};

type PersonalReportRecord = {
  projectRole: string;
  personalSelfGrowthIssue: string;
  personalSelfGrowthResult: string;
  personalSynergyIssue: string;
  personalSynergyResult: string;
};

export async function getMonthlyReportEditorBundle(
  sessionUser: SessionUser,
  input?: { yearMonth?: string; projectId?: string },
): Promise<MonthlyReportEditorBundle> {
  const viewer = toViewer(await resolveUserProfile(sessionUser));
  const currentYearMonth = getCurrentYearMonth();
  const yearMonth = isValidYearMonth(String(input?.yearMonth ?? "")) ? String(input?.yearMonth) : currentYearMonth;
  const previousYearMonth = getPreviousYearMonth(yearMonth);
  const projectId = sanitizeText(String(input?.projectId ?? ""));

  if (hasDatabaseUrl()) {
    try {
      const projectOptions = await getProjectOptionsFromDb(viewer);
      const selectedProject = projectOptions.find((project) => project.projectId === projectId) ?? null;
      const [teamReport, previousTeamReport, personalReport, previousPersonalReport] = selectedProject
        ? await Promise.all([
            selectedProject.teamId
              ? prisma.teamMonthlyReport.findUnique({
                  where: {
                    yearMonth_projectId_teamId: {
                      yearMonth,
                      projectId: selectedProject.projectId,
                      teamId: selectedProject.teamId,
                    },
                  },
                  select: {
                    projectSummary: true,
                    teamSelfGrowthIssue: true,
                    teamSelfGrowthResult: true,
                    teamSynergyIssue: true,
                    teamSynergyResult: true,
                  },
                })
              : Promise.resolve(null),
            selectedProject.teamId
              ? prisma.teamMonthlyReport.findUnique({
                  where: {
                    yearMonth_projectId_teamId: {
                      yearMonth: previousYearMonth,
                      projectId: selectedProject.projectId,
                      teamId: selectedProject.teamId,
                    },
                  },
                  select: { id: true },
                })
              : Promise.resolve(null),
            prisma.personalMonthlyReport.findUnique({
              where: {
                yearMonth_projectId_userId: {
                  yearMonth,
                  projectId: selectedProject.projectId,
                  userId: viewer.userId,
                },
              },
              select: {
                projectRole: true,
                personalSelfGrowthIssue: true,
                personalSelfGrowthResult: true,
                personalSynergyIssue: true,
                personalSynergyResult: true,
              },
            }),
            prisma.personalMonthlyReport.findUnique({
              where: {
                yearMonth_projectId_userId: {
                  yearMonth: previousYearMonth,
                  projectId: selectedProject.projectId,
                  userId: viewer.userId,
                },
              },
              select: { id: true },
            }),
          ])
        : [null, null, null, null];

      return {
        currentYearMonth,
        previousYearMonth,
        viewer,
        projectOptions,
        selectedProjectId: selectedProject?.projectId ?? "",
        selectedProjectName: selectedProject?.projectName ?? "",
        teamReport: selectedProject?.teamId ? sanitizeTeamReport(teamReport as TeamReportRecord | null) : null,
        personalReport: sanitizePersonalReport(personalReport as PersonalReportRecord | null),
        previousState: {
          hasTeamReport: Boolean(previousTeamReport),
          hasPersonalReport: Boolean(previousPersonalReport),
        },
        permissions: {
          canEditTeamReport: canEditTeamReport(viewer),
          canEditPersonalReport: true,
        },
        source: "database",
      };
    } catch {
      // fall through to file-backed fallback
    }
  }

  const data = await readMonthlyReportFile();
  const projectOptions = getProjectOptionsFromFile(data.projects, viewer);
  const selectedProject = projectOptions.find((project) => project.projectId === projectId) ?? null;
  const teamReport = selectedProject && selectedProject.teamId
    ? data.teamReports.find((row) => row.yearMonth === yearMonth && row.projectId === selectedProject.projectId && row.teamId === selectedProject.teamId)
    : null;
  const previousTeamReport = selectedProject && selectedProject.teamId
    ? data.teamReports.find((row) => row.yearMonth === previousYearMonth && row.projectId === selectedProject.projectId && row.teamId === selectedProject.teamId)
    : null;
  const personalReport = selectedProject
    ? data.personalReports.find((row) => row.yearMonth === yearMonth && row.projectId === selectedProject.projectId && row.userId === viewer.userId)
    : null;
  const previousPersonalReport = selectedProject
    ? data.personalReports.find((row) => row.yearMonth === previousYearMonth && row.projectId === selectedProject.projectId && row.userId === viewer.userId)
    : null;

  return {
    currentYearMonth,
    previousYearMonth,
    viewer,
    projectOptions,
    selectedProjectId: selectedProject?.projectId ?? "",
    selectedProjectName: selectedProject?.projectName ?? "",
    teamReport: selectedProject?.teamId ? sanitizeTeamReport(teamReport) : null,
    personalReport: sanitizePersonalReport(personalReport),
    previousState: {
      hasTeamReport: Boolean(previousTeamReport),
      hasPersonalReport: Boolean(previousPersonalReport),
    },
    permissions: {
      canEditTeamReport: canEditTeamReport(viewer),
      canEditPersonalReport: true,
    },
    source: "file",
  };
}

function teamScopeWhere(teamId: string | null): Prisma.MonthlyReportProjectWhereInput {
  return teamId ? { teamId } : { teamId: null };
}

async function saveMonthlyReportToDb(viewer: MonthlyReportViewer, input: SaveMonthlyReportInput) {
  const yearMonth = sanitizeText(input.yearMonth);
  if (!isValidYearMonth(yearMonth)) {
    throw new Error("年月は YYYY-MM 形式で入力してください。");
  }

  const requestedProjectId = sanitizeText(String(input.projectId ?? ""));
  const requestedProjectName = sanitizeText(String(input.projectName ?? ""));

  return prisma.$transaction(async (tx) => {
    let project = requestedProjectId
      ? await tx.monthlyReportProject.findUnique({
          where: { id: requestedProjectId },
          select: { id: true, name: true, teamId: true, teamNameSnapshot: true },
        })
      : null;

    if (!project) {
      if (!requestedProjectName) {
        throw new Error("プロジェクトを選択するか、新しいプロジェクト名を入力してください。");
      }

      const normalizedName = normalize(requestedProjectName);
      project = await tx.monthlyReportProject.findFirst({
        where: {
          normalizedName,
          ...teamScopeWhere(viewer.teamId),
        },
        select: { id: true, name: true, teamId: true, teamNameSnapshot: true },
      });

      if (!project) {
        project = await tx.monthlyReportProject.create({
          data: {
            name: requestedProjectName,
            normalizedName,
            teamId: viewer.teamId,
            teamNameSnapshot: viewer.teamName,
            createdBy: viewer.userId,
            isActive: true,
          },
          select: { id: true, name: true, teamId: true, teamNameSnapshot: true },
        });
      }
    }

    const personal = sanitizePersonalReport(input.personalReport);
    await tx.personalMonthlyReport.upsert({
      where: {
        yearMonth_projectId_userId: {
          yearMonth,
          projectId: project.id,
          userId: viewer.userId,
        },
      },
      update: {
        teamId: viewer.teamId,
        teamNameSnapshot: viewer.teamName,
        userRoleCode: viewer.role,
        memberType: viewer.memberType,
        ...personal,
      },
      create: {
        yearMonth,
        projectId: project.id,
        userId: viewer.userId,
        teamId: viewer.teamId,
        teamNameSnapshot: viewer.teamName,
        userRoleCode: viewer.role,
        memberType: viewer.memberType,
        ...personal,
      },
    });

    let teamReportUpdated = false;
    if (project.teamId && canEditTeamReport(viewer) && input.teamReport) {
      const team = sanitizeTeamReport(input.teamReport);
      await tx.teamMonthlyReport.upsert({
        where: {
          yearMonth_projectId_teamId: {
            yearMonth,
            projectId: project.id,
            teamId: project.teamId,
          },
        },
        update: {
          updatedBy: viewer.userId,
          ...team,
        },
        create: {
          yearMonth,
          projectId: project.id,
          teamId: project.teamId,
          updatedBy: viewer.userId,
          ...team,
        },
      });
      teamReportUpdated = true;
    }

    return {
      projectId: project.id,
      projectName: project.name,
      teamReportUpdated,
      personalReportUpdated: true,
    };
  });
}

async function saveMonthlyReportToFile(viewer: MonthlyReportViewer, input: SaveMonthlyReportInput) {
  const yearMonth = sanitizeText(input.yearMonth);
  if (!isValidYearMonth(yearMonth)) {
    throw new Error("年月は YYYY-MM 形式で入力してください。");
  }

  const data = await readMonthlyReportFile();
  const requestedProjectId = sanitizeText(String(input.projectId ?? ""));
  const requestedProjectName = sanitizeText(String(input.projectName ?? ""));
  let project = requestedProjectId
    ? data.projects.find((row) => row.id === requestedProjectId)
    : undefined;

  if (!project) {
    if (!requestedProjectName) {
      throw new Error("プロジェクトを選択するか、新しいプロジェクト名を入力してください。");
    }

    const normalizedProjectName = normalize(requestedProjectName);
    project = data.projects.find((row) => normalize(row.name) === normalizedProjectName && (row.teamId ?? "") === (viewer.teamId ?? ""));

    if (!project) {
      const now = new Date().toISOString();
      project = {
        id: randomUUID(),
        name: requestedProjectName,
        teamId: viewer.teamId,
        teamName: viewer.teamName,
        createdBy: viewer.userId,
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };
      data.projects.push(project);
    }
  }

  const now = new Date().toISOString();
  const personalExisting = data.personalReports.find((row) => row.yearMonth === yearMonth && row.projectId === project.id && row.userId === viewer.userId);
  const personalRow: StoredPersonalReport = {
    id: personalExisting?.id ?? randomUUID(),
    yearMonth,
    projectId: project.id,
    projectName: project.name,
    userId: viewer.userId,
    userName: viewer.name,
    userRole: viewer.role,
    memberType: viewer.memberType,
    teamId: viewer.teamId,
    teamName: viewer.teamName,
    createdAt: personalExisting?.createdAt ?? now,
    updatedAt: now,
    ...sanitizePersonalReport(input.personalReport),
  };

  data.personalReports = [
    ...data.personalReports.filter((row) => !(row.yearMonth === yearMonth && row.projectId === project.id && row.userId === viewer.userId)),
    personalRow,
  ];

  let teamReportUpdated = false;
  if (project.teamId && canEditTeamReport(viewer) && input.teamReport) {
    const teamExisting = data.teamReports.find((row) => row.yearMonth === yearMonth && row.projectId === project.id && row.teamId === project.teamId);
    const teamRow: StoredTeamReport = {
      id: teamExisting?.id ?? randomUUID(),
      yearMonth,
      projectId: project.id,
      teamId: project.teamId,
      teamName: project.teamName,
      updatedBy: viewer.userId,
      createdAt: teamExisting?.createdAt ?? now,
      updatedAt: now,
      ...sanitizeTeamReport(input.teamReport),
    };

    data.teamReports = [
      ...data.teamReports.filter((row) => !(row.yearMonth === yearMonth && row.projectId === project.id && row.teamId === project.teamId)),
      teamRow,
    ];
    teamReportUpdated = true;
  }

  project.updatedAt = now;
  data.projects = data.projects.map((row) => row.id === project?.id ? project as StoredProject : row);

  await writeMonthlyReportFile({
    projects: data.projects.sort((left, right) => left.name.localeCompare(right.name, "ja")),
    teamReports: data.teamReports.sort((left, right) => left.yearMonth.localeCompare(right.yearMonth) || left.teamName.localeCompare(right.teamName, "ja")),
    personalReports: data.personalReports.sort((left, right) => left.yearMonth.localeCompare(right.yearMonth) || left.userName.localeCompare(right.userName, "ja")),
  });

  return {
    projectId: project.id,
    projectName: project.name,
    teamReportUpdated,
    personalReportUpdated: true,
  };
}

export async function saveMonthlyReport(sessionUser: SessionUser, input: SaveMonthlyReportInput) {
  const viewer = toViewer(await resolveUserProfile(sessionUser));

  if (hasDatabaseUrl()) {
    try {
      return await saveMonthlyReportToDb(viewer, input);
    } catch {
      // fall through to file-backed fallback
    }
  }

  return saveMonthlyReportToFile(viewer, input);
}

async function getMonthlyReportListBundleFromDb(
  viewer: MonthlyReportViewer,
  filters: Required<MonthlyReportListFilters>,
): Promise<MonthlyReportListBundle> {
  const personalRows = await prisma.personalMonthlyReport.findMany({
    select: {
      yearMonth: true,
      projectId: true,
      teamId: true,
      teamNameSnapshot: true,
      userId: true,
      userRoleCode: true,
      memberType: true,
      projectRole: true,
      personalSelfGrowthIssue: true,
      personalSelfGrowthResult: true,
      personalSynergyIssue: true,
      personalSynergyResult: true,
      updatedAt: true,
      user: { select: { name: true } },
      project: { select: { name: true } },
      team: { select: { name: true } },
    },
    orderBy: [{ yearMonth: "desc" }, { updatedAt: "desc" }],
  });

  const teamRows = await prisma.teamMonthlyReport.findMany({
    select: {
      yearMonth: true,
      projectId: true,
      teamId: true,
      projectSummary: true,
      teamSelfGrowthIssue: true,
      teamSelfGrowthResult: true,
      teamSynergyIssue: true,
      teamSynergyResult: true,
    },
  });

  const teamReportMap = new Map(
    teamRows.map((row) => [`${row.yearMonth}:${row.projectId}:${row.teamId}`, sanitizeTeamReport(row)] as const),
  );

  const groups = new Map<string, MonthlyReportGroupRow>();
  for (const row of personalRows) {
    const userRole = sanitizeRole(row.userRoleCode);
    const memberType = sanitizeMemberType(row.memberType, userRole);
    const teamName = displayTeamName(row.team?.name ?? row.teamNameSnapshot);
    const groupKey = buildGroupKey(row.yearMonth, row.projectId, teamName);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        yearMonth: row.yearMonth,
        projectId: row.projectId,
        projectName: row.project.name,
        teamId: row.teamId,
        teamName,
        teamReport: row.teamId ? (teamReportMap.get(`${row.yearMonth}:${row.projectId}:${row.teamId}`) ?? null) : null,
        members: [],
      });
    }

    groups.get(groupKey)?.members.push({
      userId: row.userId,
      userName: row.user.name,
      userRole,
      memberType,
      projectRole: sanitizeText(row.projectRole),
      personalReport: sanitizePersonalReport(row),
      updatedAt: row.updatedAt.toISOString(),
      canEdit: viewer.userId === row.userId,
    });
  }

  const filteredGroups = Array.from(groups.values())
    .filter((group) => {
      const matchesYearMonth = !filters.yearMonth || group.yearMonth === filters.yearMonth;
      const matchesProject = !filters.projectKeyword || normalize(group.projectName).includes(normalize(filters.projectKeyword));
      const matchesTeam = !filters.teamKeyword || normalize(group.teamName).includes(normalize(filters.teamKeyword));
      const matchesUser = !filters.userKeyword || group.members.some((member) => normalize(member.userName).includes(normalize(filters.userKeyword)));
      return matchesYearMonth && matchesProject && matchesTeam && matchesUser;
    })
    .map((group) => ({
      ...group,
      members: [...group.members].sort((left, right) => {
        const leftOrder = left.memberType === "leader" ? 0 : 1;
        const rightOrder = right.memberType === "leader" ? 0 : 1;
        return leftOrder - rightOrder || left.userName.localeCompare(right.userName, "ja");
      }),
    }))
    .sort((left, right) =>
      right.yearMonth.localeCompare(left.yearMonth)
      || left.projectName.localeCompare(right.projectName, "ja")
      || left.teamName.localeCompare(right.teamName, "ja"),
    );

  return {
    filters,
    groups: filteredGroups,
    source: "database",
  };
}

async function getMonthlyReportListBundleFromFile(
  viewer: MonthlyReportViewer,
  filters: Required<MonthlyReportListFilters>,
): Promise<MonthlyReportListBundle> {
  const data = await readMonthlyReportFile();
  const teamReportMap = new Map(
    data.teamReports.map((row) => [`${row.yearMonth}:${row.projectId}:${row.teamId}`, row] as const),
  );
  const projectMap = new Map(data.projects.map((row) => [row.id, row] as const));

  const groups = new Map<string, MonthlyReportGroupRow>();
  for (const row of data.personalReports) {
    const teamName = displayTeamName(row.teamName);
    const groupKey = buildGroupKey(row.yearMonth, row.projectId, teamName);
    const project = projectMap.get(row.projectId);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        yearMonth: row.yearMonth,
        projectId: row.projectId,
        projectName: project?.name ?? row.projectName,
        teamId: row.teamId,
        teamName,
        teamReport: row.teamId ? sanitizeTeamReport(teamReportMap.get(`${row.yearMonth}:${row.projectId}:${row.teamId}`)) : null,
        members: [],
      });
    }

    groups.get(groupKey)?.members.push({
      userId: row.userId,
      userName: row.userName,
      userRole: row.userRole,
      memberType: row.memberType,
      projectRole: row.projectRole,
      personalReport: sanitizePersonalReport(row),
      updatedAt: row.updatedAt,
      canEdit: viewer.userId === row.userId,
    });
  }

  const filteredGroups = Array.from(groups.values())
    .filter((group) => {
      const matchesYearMonth = !filters.yearMonth || group.yearMonth === filters.yearMonth;
      const matchesProject = !filters.projectKeyword || normalize(group.projectName).includes(normalize(filters.projectKeyword));
      const matchesTeam = !filters.teamKeyword || normalize(group.teamName).includes(normalize(filters.teamKeyword));
      const matchesUser = !filters.userKeyword || group.members.some((member) => normalize(member.userName).includes(normalize(filters.userKeyword)));
      return matchesYearMonth && matchesProject && matchesTeam && matchesUser;
    })
    .map((group) => ({
      ...group,
      members: [...group.members].sort((left, right) => {
        const leftOrder = left.memberType === "leader" ? 0 : 1;
        const rightOrder = right.memberType === "leader" ? 0 : 1;
        return leftOrder - rightOrder || left.userName.localeCompare(right.userName, "ja");
      }),
    }))
    .sort((left, right) =>
      right.yearMonth.localeCompare(left.yearMonth)
      || left.projectName.localeCompare(right.projectName, "ja")
      || left.teamName.localeCompare(right.teamName, "ja"),
    );

  return {
    filters,
    groups: filteredGroups,
    source: "file",
  };
}

export async function getMonthlyReportListBundle(
  sessionUser: SessionUser,
  filters?: MonthlyReportListFilters,
): Promise<MonthlyReportListBundle> {
  const viewer = toViewer(await resolveUserProfile(sessionUser));
  const normalizedFilters = {
    yearMonth: sanitizeText(filters?.yearMonth ?? ""),
    projectKeyword: sanitizeText(filters?.projectKeyword ?? ""),
    teamKeyword: sanitizeText(filters?.teamKeyword ?? ""),
    userKeyword: sanitizeText(filters?.userKeyword ?? ""),
  };

  if (hasDatabaseUrl()) {
    try {
      return await getMonthlyReportListBundleFromDb(viewer, normalizedFilters);
    } catch {
      // fall through to file-backed fallback
    }
  }

  return getMonthlyReportListBundleFromFile(viewer, normalizedFilters);
}
