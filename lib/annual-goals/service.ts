import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { EvaluationPeriodStatus, ReviewType } from "@/generated/prisma";
import { getEvaluationPeriodOptions } from "@/lib/evaluations/period-service";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions/check";
import { getUnassignedPersonalProfitByUser } from "@/lib/pl/unassigned-profit-service";

const annualGoalFilePath = path.join(process.cwd(), "data", "annual-goals.json");

export type AnnualGoalType = "team" | "personal";
export type GrossProfitStatus = "achieved" | "under";
export type AnnualGoalJudgement = "gross-profit-first" | "growth-first" | "maintain-and-improve";

type AnnualGoalAnalysis = {
  grossProfitTargetRate: number;
  grossProfitActualRate: number;
  grossProfitDiff: number;
  grossProfitStatus: GrossProfitStatus;
  selfGrowthAverage: number;
  synergyAverage: number;
  selfGrowthDelta: number;
  synergyDelta: number;
  weakItems: string[];
  overallJudgement: AnnualGoalJudgement;
  insightComment: string;
  priorityThemeCandidates: string[];
};

type AnnualGoalRecord = {
  id: string;
  fiscalYear: number;
  goalType: AnnualGoalType;
  targetTeamId: string | null;
  targetUserId: string | null;
  targetName: string;
  evaluationPeriodId: string;
  evaluationPeriodName: string;
  priorityTheme: string;
  currentAnalysis: string;
  annualGoal: string;
  grossProfitActions: string;
  developmentActions: string;
  kpi: string;
  midtermMemo: string;
  analysisSnapshot: AnnualGoalAnalysis;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
};

type AnnualGoalFile = {
  goals?: AnnualGoalRecord[];
};

type ViewerTargetContext = {
  viewerId: string;
  viewerName: string;
  viewerRole: SessionUser["role"];
  teamId: string | null;
  teamName: string | null;
  teamLeaderUserId: string | null;
  goalType: AnnualGoalType;
  targetTeamId: string | null;
  targetUserId: string | null;
  targetName: string;
  canEdit: boolean;
  notice: string;
};

export type AnnualGoalEditorBundle = {
  fiscalYear: number;
  goalType: AnnualGoalType;
  targetId: string;
  targetName: string;
  notice: string;
  evaluationPeriodId: string;
  evaluationPeriodName: string;
  evaluationPeriodOptions: Array<{ id: string; name: string; status: EvaluationPeriodStatus }>;
  permissions: {
    canEdit: boolean;
  };
  analysis: AnnualGoalAnalysis;
  draft: {
    id: string | null;
    priorityTheme: string;
    currentAnalysis: string;
    annualGoal: string;
    grossProfitActions: string;
    developmentActions: string;
    kpi: string;
    midtermMemo: string;
  };
};

export type AnnualGoalListBundle = {
  filters: {
    fiscalYear: string;
    goalType: string;
    targetKeyword: string;
    priorityKeyword: string;
    grossProfitStatus: string;
  };
  permissions: {
    canViewAnalysisSummary: boolean;
  };
  rows: Array<{
    id: string;
    goalId: string | null;
    hasSavedGoal: boolean;
    fiscalYear: number;
    goalType: AnnualGoalType;
    targetName: string;
    grossProfitStatus: GrossProfitStatus;
    priorityTheme: string;
    updatedAt: string | null;
    evaluationPeriodName: string;
    canEdit: boolean;
    analysisSummary: {
      grossProfitTargetRate: number;
      grossProfitActualRate: number;
      grossProfitDiff: number;
      selfGrowthAverage: number;
      synergyAverage: number;
      overallJudgement: AnnualGoalJudgement;
      weakItems: string[];
    };
  }>;
};

export type AnnualGoalDetailBundle = {
  id: string;
  fiscalYear: number;
  goalType: AnnualGoalType;
  targetName: string;
  notice: string;
  evaluationPeriodId: string;
  evaluationPeriodName: string;
  analysis: AnnualGoalAnalysis;
  content: {
    priorityTheme: string;
    currentAnalysis: string;
    annualGoal: string;
    grossProfitActions: string;
    developmentActions: string;
    kpi: string;
    midtermMemo: string;
  };
  meta: {
    createdByName: string;
    updatedByName: string;
    createdAt: string;
    updatedAt: string;
    canEdit: boolean;
  };
};

type AnnualGoalAnalysisTarget = {
  id: string;
  goalType: AnnualGoalType;
  targetTeamId: string | null;
  targetUserId: string | null;
  targetName: string;
};

export type AnnualGoalReference = {
  fiscalYear: number;
  goalType: AnnualGoalType;
  targetName: string;
  priorityTheme: string;
  annualGoal: string;
  id: string;
} | null;

export type SaveAnnualGoalInput = {
  id?: string;
  fiscalYear: number;
  evaluationPeriodId: string;
  priorityTheme: string;
  currentAnalysis: string;
  annualGoal: string;
  grossProfitActions: string;
  developmentActions: string;
  kpi: string;
  midtermMemo: string;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string) {
  return String(value ?? "").trim();
}

function normalizeSearch(value: string) {
  return normalizeText(value).toLowerCase();
}

function sanitizeNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function sanitizeGoalType(value: unknown): AnnualGoalType {
  return value === "personal" ? "personal" : "team";
}

function sanitizeGrossProfitStatus(value: unknown): GrossProfitStatus {
  return value === "under" ? "under" : "achieved";
}

function sanitizeAnnualGoalJudgement(value: unknown): AnnualGoalJudgement {
  if (value === "gross-profit-first" || value === "growth-first" || value === "maintain-and-improve") {
    return value;
  }
  return "growth-first";
}

function getCurrentFiscalYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? year : year - 1;
}

function resolveFiscalYearFromYearMonth(yearMonth: string) {
  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return getCurrentFiscalYear();
  }
  return month >= 4 ? year : year - 1;
}

function buildFallbackAnalysis(): AnnualGoalAnalysis {
  return {
    grossProfitTargetRate: 32,
    grossProfitActualRate: 27.5,
    grossProfitDiff: -4.5,
    grossProfitStatus: "under",
    selfGrowthAverage: 61.5,
    synergyAverage: 68.2,
    selfGrowthDelta: -3.1,
    synergyDelta: 1.2,
    weakItems: ["課題設定", "主体的行動"],
    overallJudgement: "gross-profit-first",
    insightComment: "粗利目標が未達のため、まずは収益性改善を最優先にし、自律的成長の底上げを進めるのが有効です。",
    priorityThemeCandidates: ["粗利達成を最優先", "自律的成長の底上げ", "案件推進の標準化"],
  };
}

function sanitizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(String(item ?? ""))).filter(Boolean)
    : [];
}

function sanitizeAnnualGoalAnalysis(input?: Partial<AnnualGoalAnalysis> | null): AnnualGoalAnalysis {
  const fallback = buildFallbackAnalysis();
  return {
    grossProfitTargetRate: sanitizeNumber(input?.grossProfitTargetRate, fallback.grossProfitTargetRate),
    grossProfitActualRate: sanitizeNumber(input?.grossProfitActualRate, fallback.grossProfitActualRate),
    grossProfitDiff: sanitizeNumber(input?.grossProfitDiff, fallback.grossProfitDiff),
    grossProfitStatus: sanitizeGrossProfitStatus(input?.grossProfitStatus),
    selfGrowthAverage: sanitizeNumber(input?.selfGrowthAverage, fallback.selfGrowthAverage),
    synergyAverage: sanitizeNumber(input?.synergyAverage, fallback.synergyAverage),
    selfGrowthDelta: sanitizeNumber(input?.selfGrowthDelta, fallback.selfGrowthDelta),
    synergyDelta: sanitizeNumber(input?.synergyDelta, fallback.synergyDelta),
    weakItems: sanitizeStringArray(input?.weakItems),
    overallJudgement: sanitizeAnnualGoalJudgement(input?.overallJudgement),
    insightComment: normalizeText(String(input?.insightComment ?? "")) || fallback.insightComment,
    priorityThemeCandidates: sanitizeStringArray(input?.priorityThemeCandidates),
  };
}

function sanitizeAnnualGoalRecord(input: Partial<AnnualGoalRecord>): AnnualGoalRecord | null {
  const id = normalizeText(String(input.id ?? ""));
  const fiscalYear = sanitizeNumber(input.fiscalYear, getCurrentFiscalYear());
  const goalType = sanitizeGoalType(input.goalType);
  const targetName = normalizeText(String(input.targetName ?? ""));
  const evaluationPeriodId = normalizeText(String(input.evaluationPeriodId ?? ""));
  const evaluationPeriodName = normalizeText(String(input.evaluationPeriodName ?? ""));

  if (!id || !targetName || !evaluationPeriodId || !evaluationPeriodName) {
    return null;
  }

  return {
    id,
    fiscalYear,
    goalType,
    targetTeamId: input.targetTeamId ? normalizeText(String(input.targetTeamId)) : null,
    targetUserId: input.targetUserId ? normalizeText(String(input.targetUserId)) : null,
    targetName,
    evaluationPeriodId,
    evaluationPeriodName,
    priorityTheme: normalizeText(String(input.priorityTheme ?? "")),
    currentAnalysis: normalizeText(String(input.currentAnalysis ?? "")),
    annualGoal: normalizeText(String(input.annualGoal ?? "")),
    grossProfitActions: normalizeText(String(input.grossProfitActions ?? "")),
    developmentActions: normalizeText(String(input.developmentActions ?? "")),
    kpi: normalizeText(String(input.kpi ?? "")),
    midtermMemo: normalizeText(String(input.midtermMemo ?? "")),
    analysisSnapshot: sanitizeAnnualGoalAnalysis(input.analysisSnapshot),
    createdBy: normalizeText(String(input.createdBy ?? "")),
    createdByName: normalizeText(String(input.createdByName ?? "")),
    updatedBy: normalizeText(String(input.updatedBy ?? "")),
    updatedByName: normalizeText(String(input.updatedByName ?? "")),
    createdAt: String(input.createdAt ?? new Date().toISOString()),
    updatedAt: String(input.updatedAt ?? new Date().toISOString()),
  };
}

function mapJudgementLabel(value: AnnualGoalJudgement) {
  switch (value) {
    case "gross-profit-first":
      return "粗利優先";
    case "growth-first":
      return "成長課題優先";
    case "maintain-and-improve":
    default:
      return "維持向上";
  }
}

function buildInsightComment(
  grossProfitStatus: GrossProfitStatus,
  weakerAxis: "self" | "synergy" | "balanced",
  weakItems: string[],
  judgement: AnnualGoalJudgement,
) {
  if (judgement === "gross-profit-first") {
    if (weakerAxis === "self") {
      return `粗利目標が未達のため、まずは収益性改善を最優先にし、自律的成長の底上げと${weakItems[0] ?? "案件推進"}の改善を進めるのが有効です。`;
    }
    if (weakerAxis === "synergy") {
      return `粗利目標が未達のため、まずは収益性改善を最優先にし、協調相乗の強化と${weakItems[0] ?? "連携品質"}の改善を進めるのが有効です。`;
    }
    return "粗利目標が未達のため、まずは収益性改善を最優先にし、案件推進の標準化と手戻り削減を進めるのが有効です。";
  }

  if (grossProfitStatus === "achieved" && judgement === "growth-first") {
    return "粗利目標は達成しているため、今年度は成長課題の改善を中心に、次の成果につながる行動強化を進めるのが有効です。";
  }

  return "粗利と評価の両面で大きな崩れはないため、強みを維持しながら次段階の挑戦へつなげる目標設定が適しています。";
}

function buildPriorityThemeCandidates(
  judgement: AnnualGoalJudgement,
  weakerAxis: "self" | "synergy" | "balanced",
) {
  if (judgement === "gross-profit-first") {
    return weakerAxis === "synergy"
      ? ["粗利達成を最優先", "協調相乗の強化", "手戻り削減と連携強化"]
      : weakerAxis === "self"
        ? ["粗利達成を最優先", "自律的成長の底上げ", "案件推進の標準化"]
        : ["粗利達成を最優先", "案件推進の標準化", "手戻り削減と連携強化"];
  }

  if (judgement === "growth-first") {
    return weakerAxis === "synergy"
      ? ["協調相乗の強化", "手戻り削減と連携強化", "自律と協調の両立"]
      : weakerAxis === "self"
        ? ["自律的成長の底上げ", "案件推進の標準化", "自律と協調の両立"]
        : ["自律と協調の両立", "育成の標準化", "強みの維持と次段階挑戦"];
  }

  return ["強みの維持と次段階挑戦", "自律と協調の両立", "育成の標準化"];
}

async function readAnnualGoalFile(): Promise<AnnualGoalRecord[]> {
  try {
    const raw = await readFile(annualGoalFilePath, "utf8");
    const parsed = JSON.parse(raw) as AnnualGoalFile;
    return (parsed.goals ?? [])
      .map((goal) => sanitizeAnnualGoalRecord(goal))
      .filter((goal): goal is AnnualGoalRecord => Boolean(goal));
  } catch {
    return [];
  }
}

async function writeAnnualGoalFile(goals: AnnualGoalRecord[]) {
  await mkdir(path.dirname(annualGoalFilePath), { recursive: true });
  await writeFile(annualGoalFilePath, `${JSON.stringify({ goals }, null, 2)}\n`, "utf8");
}

async function resolveViewerTargetContext(sessionUser: SessionUser): Promise<ViewerTargetContext> {
  if (hasDatabaseUrl()) {
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
              team: {
                select: {
                  id: true,
                  name: true,
                  leaderUserId: true,
                },
              },
            },
          },
        },
      });

      const membership = user?.teamMemberships[0];
      if (membership?.team) {
        const canEdit = membership.team.leaderUserId === sessionUser.id;
        return {
          viewerId: sessionUser.id,
          viewerName: user?.name ?? sessionUser.name,
          viewerRole: sessionUser.role,
          teamId: membership.team.id,
          teamName: membership.team.name,
          teamLeaderUserId: membership.team.leaderUserId ?? null,
          goalType: "team",
          targetTeamId: membership.team.id,
          targetUserId: null,
          targetName: membership.team.name,
          canEdit,
          notice: canEdit ? "チーム年度目標を入力します。" : "チーム年度目標はリーダーが入力します。",
        };
      }
    } catch {
      // fall through to session-based fallback
    }
  }

  if (sessionUser.teamIds[0]) {
    const isLeader = sessionUser.role === "leader";
    return {
      viewerId: sessionUser.id,
      viewerName: sessionUser.name,
      viewerRole: sessionUser.role,
      teamId: sessionUser.teamIds[0],
      teamName: sessionUser.teamIds[0],
      teamLeaderUserId: isLeader ? sessionUser.id : null,
      goalType: "team",
      targetTeamId: sessionUser.teamIds[0],
      targetUserId: null,
      targetName: sessionUser.teamIds[0],
      canEdit: isLeader,
      notice: isLeader ? "チーム年度目標を入力します。" : "チーム年度目標はリーダーが入力します。",
    };
  }

  return {
    viewerId: sessionUser.id,
    viewerName: sessionUser.name,
    viewerRole: sessionUser.role,
    teamId: null,
    teamName: null,
    teamLeaderUserId: null,
    goalType: "personal",
    targetTeamId: null,
    targetUserId: sessionUser.id,
    targetName: sessionUser.name,
    canEdit: true,
    notice: "未所属のため、個人年度目標を入力します。",
  };
}

async function resolvePeriodWithRange(evaluationPeriodId?: string) {
  const options = await getEvaluationPeriodOptions();
  const selectedOption = options.find((option) => option.id === evaluationPeriodId) ?? options[0] ?? {
    id: "period-2025-h2",
    name: "2025年度下期",
    status: EvaluationPeriodStatus.OPEN,
  };

  if (!hasDatabaseUrl()) {
    const fallbackStart = new Date(Date.UTC(2025, 9, 1));
    const fallbackEnd = new Date(Date.UTC(2026, 2, 31));
    return {
      id: selectedOption.id,
      name: selectedOption.name,
      status: selectedOption.status,
      startDate: fallbackStart,
      endDate: fallbackEnd,
      options,
    };
  }

  try {
    const period = await prisma.evaluationPeriod.findUnique({
      where: { id: selectedOption.id },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (period) {
      return { ...period, options };
    }
  } catch {
    // use fallback below
  }

  const fallbackStart = new Date(Date.UTC(2025, 9, 1));
  const fallbackEnd = new Date(Date.UTC(2026, 2, 31));
  return {
    id: selectedOption.id,
    name: selectedOption.name,
    status: selectedOption.status,
    startDate: fallbackStart,
    endDate: fallbackEnd,
    options,
  };
}

function buildPeriodYearMonths(periodStartDate: Date, periodEndDate: Date) {
  const months: string[] = [];
  const cursor = new Date(periodStartDate.getFullYear(), periodStartDate.getMonth(), 1);
  const end = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), 1);

  while (cursor <= end) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

async function resolvePreviousPeriodId(evaluationPeriodId: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  try {
    const periods = await prisma.evaluationPeriod.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true },
    });
    const currentIndex = periods.findIndex((period) => period.id === evaluationPeriodId);
    return currentIndex > 0 ? periods[currentIndex - 1]?.id ?? null : null;
  } catch {
    return null;
  }
}

function resolvePreferredReviewType(status: string) {
  if (status === "FINALIZED") {
    return ReviewType.FINAL;
  }
  if (status === "MANAGER_REVIEW" || status === "FINAL_REVIEW") {
    return ReviewType.MANAGER;
  }
  return ReviewType.SELF;
}

async function resolveTargetUserIds(context: ViewerTargetContext) {
  if (!hasDatabaseUrl()) {
    return context.goalType === "personal" && context.targetUserId ? [context.targetUserId] : [];
  }

  if (context.goalType === "personal" && context.targetUserId) {
    return [context.targetUserId];
  }

  if (!context.targetTeamId) {
    return [];
  }

  const memberships = await prisma.teamMembership.findMany({
    where: {
      teamId: context.targetTeamId,
      isPrimary: true,
      endDate: null,
    },
    select: { userId: true },
  });

  return memberships.map((membership) => membership.userId);
}

async function resolveAnnualGoalAnalysisTargets(sessionUser: SessionUser, goalTypeFilter?: string): Promise<AnnualGoalAnalysisTarget[]> {
  const includeTeam = !goalTypeFilter || goalTypeFilter === "team";
  const includePersonal = !goalTypeFilter || goalTypeFilter === "personal";

  if (!hasDatabaseUrl()) {
    const fallback: AnnualGoalAnalysisTarget[] = [];
    if (includeTeam) {
      fallback.push({
        id: "team:team-platform",
        goalType: "team",
        targetTeamId: "team-platform",
        targetUserId: null,
        targetName: "プラットフォームチーム",
      });
    }
    if (includePersonal) {
      fallback.push(
        {
          id: "user:demo-admin",
          goalType: "personal",
          targetTeamId: null,
          targetUserId: "demo-admin",
          targetName: "管理 花子",
        },
        {
          id: "user:demo-leader",
          goalType: "personal",
          targetTeamId: null,
          targetUserId: "demo-leader",
          targetName: "主任 次郎",
        },
        {
          id: "user:demo-employee",
          goalType: "personal",
          targetTeamId: null,
          targetUserId: "demo-employee",
          targetName: "開発 一郎",
        },
      );
    }
    return fallback;
  }

  const targets: AnnualGoalAnalysisTarget[] = [];

  if (includeTeam) {
    const teams = await prisma.team.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    targets.push(
      ...teams.map((team) => ({
        id: `team:${team.id}`,
        goalType: "team" as const,
        targetTeamId: team.id,
        targetUserId: null,
        targetName: team.name,
      })),
    );
  }

  if (includePersonal) {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ employeeCode: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    });
    targets.push(
      ...users.map((user) => ({
        id: `user:${user.id}`,
        goalType: "personal" as const,
        targetTeamId: null,
        targetUserId: user.id,
        targetName: user.name,
      })),
    );
  }

  return targets;
}

async function calculateGrossProfitAnalysis(context: ViewerTargetContext, evaluationPeriodId: string) {
  if (!hasDatabaseUrl()) {
    return {
      grossProfitTargetRate: 32,
      grossProfitActualRate: 27.5,
      grossProfitDiff: -4.5,
      grossProfitStatus: "under" as const,
    };
  }

  const period = await resolvePeriodWithRange(evaluationPeriodId);
  const months = buildPeriodYearMonths(period.startDate, period.endDate);

  if (context.goalType === "team" && context.targetTeamId) {
    const rows = await prisma.teamMonthlyPl.findMany({
      where: {
        teamId: context.targetTeamId,
        yearMonth: { in: months },
      },
      select: {
        salesTotal: true,
        finalGrossProfit: true,
        targetGrossProfitRate: true,
      },
    });

    const salesTotal = rows.reduce((sum, row) => sum + Number(row.salesTotal ?? 0), 0);
    const finalGrossProfit = rows.reduce((sum, row) => sum + Number(row.finalGrossProfit ?? 0), 0);
    const targetGrossProfitRate = rows.length > 0
      ? round2(rows.reduce((sum, row) => sum + Number(row.targetGrossProfitRate ?? 0), 0) / rows.length)
      : 0;
    const actualGrossProfitRate = salesTotal === 0 ? 0 : round2((finalGrossProfit / salesTotal) * 100);
    const grossProfitDiff = round2(actualGrossProfitRate - targetGrossProfitRate);

    return {
      grossProfitTargetRate: targetGrossProfitRate,
      grossProfitActualRate: actualGrossProfitRate,
      grossProfitDiff,
      grossProfitStatus: grossProfitDiff < 0 ? "under" as const : "achieved" as const,
    };
  }

  if (!context.targetUserId) {
    return {
      grossProfitTargetRate: 0,
      grossProfitActualRate: 0,
      grossProfitDiff: 0,
      grossProfitStatus: "achieved" as const,
    };
  }

  const rows = await Promise.all(months.map((yearMonth) => getUnassignedPersonalProfitByUser(context.targetUserId!, yearMonth)));
  const effectiveRows = rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
  const salesTotal = effectiveRows.reduce((sum, row) => sum + row.salesTotal, 0);
  const finalGrossProfit = effectiveRows.reduce((sum, row) => sum + row.finalGrossProfit, 0);
  const targetGrossProfitRate = effectiveRows.length > 0
    ? round2(effectiveRows.reduce((sum, row) => sum + row.targetGrossProfitRate, 0) / effectiveRows.length)
    : 0;
  const actualGrossProfitRate = salesTotal === 0 ? 0 : round2((finalGrossProfit / salesTotal) * 100);
  const grossProfitDiff = round2(actualGrossProfitRate - targetGrossProfitRate);

  return {
    grossProfitTargetRate: targetGrossProfitRate,
    grossProfitActualRate: actualGrossProfitRate,
    grossProfitDiff,
    grossProfitStatus: grossProfitDiff < 0 ? "under" as const : "achieved" as const,
  };
}

async function calculateEvaluationMetrics(userIds: string[], evaluationPeriodId: string) {
  if (!hasDatabaseUrl() || userIds.length === 0) {
    return {
      selfGrowthAverage: 61.5,
      synergyAverage: 68.2,
      selfGrowthDelta: -3.1,
      synergyDelta: 1.2,
      weakItems: ["課題設定", "主体的行動"],
    };
  }

  const previousPeriodId = await resolvePreviousPeriodId(evaluationPeriodId);

  const [currentEvaluations, previousEvaluations] = await Promise.all([
    prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId,
        userId: { in: userIds },
      },
      select: {
        status: true,
        scores: {
          select: {
            reviewType: true,
            score: true,
            evaluationItem: {
              select: {
                axis: true,
                majorCategory: true,
                weight: true,
                scoreType: true,
              },
            },
          },
        },
      },
    }),
    previousPeriodId
      ? prisma.employeeEvaluation.findMany({
          where: {
            evaluationPeriodId: previousPeriodId,
            userId: { in: userIds },
          },
          select: {
            status: true,
            scores: {
              select: {
                reviewType: true,
                score: true,
                evaluationItem: {
                  select: {
                    axis: true,
                    majorCategory: true,
                    weight: true,
                    scoreType: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  function summarize(
    evaluations: Array<{
      status: string;
      scores: Array<{
        reviewType: ReviewType;
        score: unknown;
        evaluationItem: {
          axis: "SELF_GROWTH" | "SYNERGY";
          majorCategory: string;
          weight: unknown;
          scoreType: "LEVEL_2" | "CONTINUOUS_DONE";
        };
      }>;
    }>,
  ) {
    let selfAchieved = 0;
    let selfPossible = 0;
    let synergyAchieved = 0;
    let synergyPossible = 0;
    const majorCategoryMap = new Map<string, { achieved: number; possible: number }>();

    for (const evaluation of evaluations) {
      const preferredReviewType = resolvePreferredReviewType(evaluation.status);
      const filteredScores = evaluation.scores.filter((score) => score.reviewType === preferredReviewType);

      for (const score of filteredScores) {
        const weight = Number(score.evaluationItem.weight ?? 0);
        const maxScore = score.evaluationItem.scoreType === "CONTINUOUS_DONE" ? 1 : 2;
        const achieved = Number(score.score ?? 0) * weight;
        const possible = maxScore * weight;
        const majorCategory = normalizeText(score.evaluationItem.majorCategory) || "その他";

        if (score.evaluationItem.axis === "SELF_GROWTH") {
          selfAchieved += achieved;
          selfPossible += possible;
        } else {
          synergyAchieved += achieved;
          synergyPossible += possible;
        }

        const current = majorCategoryMap.get(majorCategory) ?? { achieved: 0, possible: 0 };
        current.achieved += achieved;
        current.possible += possible;
        majorCategoryMap.set(majorCategory, current);
      }
    }

    const selfGrowthAverage = selfPossible === 0 ? 0 : round1((selfAchieved / selfPossible) * 100);
    const synergyAverage = synergyPossible === 0 ? 0 : round1((synergyAchieved / synergyPossible) * 100);
    const weakItems = Array.from(majorCategoryMap.entries())
      .map(([name, metric]) => ({
        name,
        value: metric.possible === 0 ? 0 : round1((metric.achieved / metric.possible) * 100),
      }))
      .sort((left, right) => left.value - right.value)
      .slice(0, 3)
      .map((item) => item.name);

    return { selfGrowthAverage, synergyAverage, weakItems };
  }

  const current = summarize(currentEvaluations);
  const previous = summarize(previousEvaluations);

  return {
    selfGrowthAverage: current.selfGrowthAverage,
    synergyAverage: current.synergyAverage,
    selfGrowthDelta: round1(current.selfGrowthAverage - previous.selfGrowthAverage),
    synergyDelta: round1(current.synergyAverage - previous.synergyAverage),
    weakItems: current.weakItems,
  };
}

async function buildAnalysis(context: ViewerTargetContext, evaluationPeriodId: string): Promise<AnnualGoalAnalysis> {
  if (!hasDatabaseUrl()) {
    return buildFallbackAnalysis();
  }

  try {
    const [grossProfit, userIds] = await Promise.all([
      calculateGrossProfitAnalysis(context, evaluationPeriodId),
      resolveTargetUserIds(context),
    ]);
    const evaluation = await calculateEvaluationMetrics(userIds, evaluationPeriodId);

    const weakerAxis = evaluation.selfGrowthAverage < evaluation.synergyAverage
      ? "self"
      : evaluation.synergyAverage < evaluation.selfGrowthAverage
        ? "synergy"
        : "balanced";

    const overallJudgement: AnnualGoalJudgement = grossProfit.grossProfitStatus === "under"
      ? "gross-profit-first"
      : evaluation.selfGrowthAverage < 70 || evaluation.synergyAverage < 70 || evaluation.selfGrowthDelta < 0 || evaluation.synergyDelta < 0
        ? "growth-first"
        : "maintain-and-improve";

    const priorityThemeCandidates = buildPriorityThemeCandidates(overallJudgement, weakerAxis);
    const insightComment = buildInsightComment(grossProfit.grossProfitStatus, weakerAxis, evaluation.weakItems, overallJudgement);

    return {
      grossProfitTargetRate: grossProfit.grossProfitTargetRate,
      grossProfitActualRate: grossProfit.grossProfitActualRate,
      grossProfitDiff: grossProfit.grossProfitDiff,
      grossProfitStatus: grossProfit.grossProfitStatus,
      selfGrowthAverage: evaluation.selfGrowthAverage,
      synergyAverage: evaluation.synergyAverage,
      selfGrowthDelta: evaluation.selfGrowthDelta,
      synergyDelta: evaluation.synergyDelta,
      weakItems: evaluation.weakItems,
      overallJudgement,
      insightComment,
      priorityThemeCandidates,
    };
  } catch {
    return buildFallbackAnalysis();
  }
}

function canEditRecord(record: AnnualGoalRecord, context: ViewerTargetContext) {
  if (record.goalType === "team") {
    return Boolean(context.canEdit && context.targetTeamId && context.targetTeamId === record.targetTeamId);
  }
  return Boolean(context.targetUserId && context.targetUserId === record.targetUserId);
}

function findExistingGoal(goals: AnnualGoalRecord[], context: ViewerTargetContext, fiscalYear: number) {
  return goals.find((goal) =>
    goal.fiscalYear === fiscalYear
    && goal.goalType === context.goalType
    && (
      (goal.goalType === "team" && goal.targetTeamId === context.targetTeamId)
      || (goal.goalType === "personal" && goal.targetUserId === context.targetUserId)
    ),
  ) ?? null;
}

export async function getAnnualGoalEditorBundle(
  sessionUser: SessionUser,
  input?: { fiscalYear?: string; evaluationPeriodId?: string },
): Promise<AnnualGoalEditorBundle> {
  const context = await resolveViewerTargetContext(sessionUser);
  const fiscalYear = Number.isFinite(Number(input?.fiscalYear)) ? Number(input?.fiscalYear) : getCurrentFiscalYear();
  const goals = await readAnnualGoalFile();
  const existingGoal = findExistingGoal(goals, context, fiscalYear);
  const period = await resolvePeriodWithRange(input?.evaluationPeriodId ?? existingGoal?.evaluationPeriodId);
  const analysis = await buildAnalysis(context, period.id);

  return {
    fiscalYear,
    goalType: context.goalType,
    targetId: context.goalType === "team" ? context.targetTeamId ?? "" : context.targetUserId ?? "",
    targetName: context.targetName,
    notice: context.notice,
    evaluationPeriodId: period.id,
    evaluationPeriodName: period.name,
    evaluationPeriodOptions: period.options,
    permissions: {
      canEdit: context.canEdit,
    },
    analysis,
    draft: {
      id: existingGoal?.id ?? null,
      priorityTheme: existingGoal?.priorityTheme ?? analysis.priorityThemeCandidates[0] ?? "",
      currentAnalysis: existingGoal?.currentAnalysis ?? "",
      annualGoal: existingGoal?.annualGoal ?? "",
      grossProfitActions: existingGoal?.grossProfitActions ?? "",
      developmentActions: existingGoal?.developmentActions ?? "",
      kpi: existingGoal?.kpi ?? "",
      midtermMemo: existingGoal?.midtermMemo ?? "",
    },
  };
}

export async function getAnnualGoalListBundle(
  sessionUser: SessionUser,
  filters?: {
    fiscalYear?: string;
    goalType?: string;
    targetKeyword?: string;
    priorityKeyword?: string;
    grossProfitStatus?: string;
  },
): Promise<AnnualGoalListBundle> {
  const goals = await readAnnualGoalFile();
  const normalizedFilters = {
    fiscalYear: normalizeText(filters?.fiscalYear ?? ""),
    goalType: normalizeText(filters?.goalType ?? ""),
    targetKeyword: normalizeText(filters?.targetKeyword ?? ""),
    priorityKeyword: normalizeText(filters?.priorityKeyword ?? ""),
    grossProfitStatus: normalizeText(filters?.grossProfitStatus ?? ""),
  };
  const canViewAnalysisSummary = sessionUser.role === "admin" || sessionUser.role === "president";
  const effectiveFiscalYear = Number.isFinite(Number(normalizedFilters.fiscalYear))
    ? Number(normalizedFilters.fiscalYear)
    : getCurrentFiscalYear();

  let rows: AnnualGoalListBundle["rows"] = [];

  if (canViewAnalysisSummary) {
    const targets = await resolveAnnualGoalAnalysisTargets(sessionUser, normalizedFilters.goalType);
    const rowsWithAnalysis = await Promise.all(
      targets.map(async (target) => {
        const existingGoal = goals.find((goal) =>
          goal.fiscalYear === effectiveFiscalYear
          && goal.goalType === target.goalType
          && (
            (target.goalType === "team" && goal.targetTeamId === target.targetTeamId)
            || (target.goalType === "personal" && goal.targetUserId === target.targetUserId)
          ),
        ) ?? null;

        const context: ViewerTargetContext = {
          viewerId: sessionUser.id,
          viewerName: sessionUser.name,
          viewerRole: sessionUser.role,
          teamId: null,
          teamName: null,
          teamLeaderUserId: null,
          goalType: target.goalType,
          targetTeamId: target.targetTeamId,
          targetUserId: target.targetUserId,
          targetName: target.targetName,
          canEdit: false,
          notice: target.goalType === "team" ? "チーム年度目標を表示します。" : "個人年度目標を表示します。",
        };
        const period = await resolvePeriodWithRange(existingGoal?.evaluationPeriodId);
        const analysis = existingGoal?.analysisSnapshot ?? await buildAnalysis(context, period.id);

        return {
          id: existingGoal?.id ?? target.id,
          goalId: existingGoal?.id ?? null,
          hasSavedGoal: Boolean(existingGoal),
          fiscalYear: effectiveFiscalYear,
          goalType: target.goalType,
          targetName: target.targetName,
          grossProfitStatus: analysis.grossProfitStatus,
          priorityTheme: existingGoal?.priorityTheme ?? "",
          updatedAt: existingGoal?.updatedAt ?? null,
          evaluationPeriodName: existingGoal?.evaluationPeriodName ?? period.name,
          canEdit: false,
          analysisSummary: {
            grossProfitTargetRate: analysis.grossProfitTargetRate,
            grossProfitActualRate: analysis.grossProfitActualRate,
            grossProfitDiff: analysis.grossProfitDiff,
            selfGrowthAverage: analysis.selfGrowthAverage,
            synergyAverage: analysis.synergyAverage,
            overallJudgement: analysis.overallJudgement,
            weakItems: analysis.weakItems,
          },
        };
      }),
    );

    rows = rowsWithAnalysis
      .filter((row) => {
        const matchesTarget = !normalizedFilters.targetKeyword || normalizeSearch(row.targetName).includes(normalizeSearch(normalizedFilters.targetKeyword));
        const matchesPriority = !normalizedFilters.priorityKeyword || normalizeSearch(row.priorityTheme).includes(normalizeSearch(normalizedFilters.priorityKeyword));
        const matchesStatus = !normalizedFilters.grossProfitStatus || row.grossProfitStatus === normalizedFilters.grossProfitStatus;
        return matchesTarget && matchesPriority && matchesStatus;
      })
      .sort((left, right) =>
        left.goalType.localeCompare(right.goalType)
        || left.targetName.localeCompare(right.targetName, "ja"),
      );
  } else {
    const context = await resolveViewerTargetContext(sessionUser);
    rows = goals
      .filter((goal) => {
        const matchesFiscalYear = !normalizedFilters.fiscalYear || String(goal.fiscalYear) === normalizedFilters.fiscalYear;
        const matchesGoalType = !normalizedFilters.goalType || goal.goalType === normalizedFilters.goalType;
        const matchesTarget = !normalizedFilters.targetKeyword || normalizeSearch(goal.targetName).includes(normalizeSearch(normalizedFilters.targetKeyword));
        const matchesPriority = !normalizedFilters.priorityKeyword || normalizeSearch(goal.priorityTheme).includes(normalizeSearch(normalizedFilters.priorityKeyword));
        const matchesStatus = !normalizedFilters.grossProfitStatus || goal.analysisSnapshot.grossProfitStatus === normalizedFilters.grossProfitStatus;
        return matchesFiscalYear && matchesGoalType && matchesTarget && matchesPriority && matchesStatus;
      })
      .sort((left, right) =>
        right.fiscalYear - left.fiscalYear
        || right.updatedAt.localeCompare(left.updatedAt)
        || left.targetName.localeCompare(right.targetName, "ja"),
      )
      .map((goal) => ({
        id: goal.id,
        goalId: goal.id,
        hasSavedGoal: true,
        fiscalYear: goal.fiscalYear,
        goalType: goal.goalType,
        targetName: goal.targetName,
        grossProfitStatus: goal.analysisSnapshot.grossProfitStatus,
        priorityTheme: goal.priorityTheme,
        updatedAt: goal.updatedAt,
        evaluationPeriodName: goal.evaluationPeriodName,
        canEdit: canEditRecord(goal, context),
        analysisSummary: {
          grossProfitTargetRate: goal.analysisSnapshot.grossProfitTargetRate,
          grossProfitActualRate: goal.analysisSnapshot.grossProfitActualRate,
          grossProfitDiff: goal.analysisSnapshot.grossProfitDiff,
          selfGrowthAverage: goal.analysisSnapshot.selfGrowthAverage,
          synergyAverage: goal.analysisSnapshot.synergyAverage,
          overallJudgement: goal.analysisSnapshot.overallJudgement,
          weakItems: goal.analysisSnapshot.weakItems,
        },
      }));
  }

  return {
    filters: normalizedFilters,
    permissions: {
      canViewAnalysisSummary,
    },
    rows,
  };
}

export async function getAnnualGoalDetailBundle(sessionUser: SessionUser, id: string): Promise<AnnualGoalDetailBundle | null> {
  const context = await resolveViewerTargetContext(sessionUser);
  const goals = await readAnnualGoalFile();
  const goal = goals.find((row) => row.id === id);

  if (!goal) {
    return null;
  }

  return {
    id: goal.id,
    fiscalYear: goal.fiscalYear,
    goalType: goal.goalType,
    targetName: goal.targetName,
    notice: goal.goalType === "team" ? "チーム年度目標" : "個人年度目標",
    evaluationPeriodId: goal.evaluationPeriodId,
    evaluationPeriodName: goal.evaluationPeriodName,
    analysis: goal.analysisSnapshot,
    content: {
      priorityTheme: goal.priorityTheme,
      currentAnalysis: goal.currentAnalysis,
      annualGoal: goal.annualGoal,
      grossProfitActions: goal.grossProfitActions,
      developmentActions: goal.developmentActions,
      kpi: goal.kpi,
      midtermMemo: goal.midtermMemo,
    },
    meta: {
      createdByName: goal.createdByName,
      updatedByName: goal.updatedByName,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      canEdit: canEditRecord(goal, context),
    },
  };
}

export async function getAnnualGoalReferenceByYearMonth(sessionUser: SessionUser, yearMonth: string): Promise<AnnualGoalReference> {
  const context = await resolveViewerTargetContext(sessionUser);
  const fiscalYear = resolveFiscalYearFromYearMonth(yearMonth);
  const goals = await readAnnualGoalFile();
  const goal = findExistingGoal(goals, context, fiscalYear);

  if (!goal) {
    return null;
  }

  return {
    id: goal.id,
    fiscalYear: goal.fiscalYear,
    goalType: goal.goalType,
    targetName: goal.targetName,
    priorityTheme: goal.priorityTheme,
    annualGoal: goal.annualGoal,
  };
}

export async function saveAnnualGoal(sessionUser: SessionUser, input: SaveAnnualGoalInput) {
  const context = await resolveViewerTargetContext(sessionUser);
  if (!context.canEdit) {
    throw new Error(context.notice);
  }

  const fiscalYear = Number.isFinite(Number(input.fiscalYear)) ? Number(input.fiscalYear) : getCurrentFiscalYear();
  const evaluationPeriodId = normalizeText(input.evaluationPeriodId);
  const priorityTheme = normalizeText(input.priorityTheme);
  const annualGoal = normalizeText(input.annualGoal);

  if (!evaluationPeriodId) {
    throw new Error("対象評価期間を選択してください。");
  }
  if (!priorityTheme) {
    throw new Error("優先テーマを入力してください。");
  }
  if (!annualGoal) {
    throw new Error("年度目標を入力してください。");
  }

  const period = await resolvePeriodWithRange(evaluationPeriodId);
  const analysis = await buildAnalysis(context, period.id);
  const goals = await readAnnualGoalFile();
  const existingGoal = goals.find((goal) =>
    goal.id === input.id
    || (
      goal.fiscalYear === fiscalYear
      && goal.goalType === context.goalType
      && (
        (goal.goalType === "team" && goal.targetTeamId === context.targetTeamId)
        || (goal.goalType === "personal" && goal.targetUserId === context.targetUserId)
      )
    ),
  );

  const now = new Date().toISOString();
  const nextGoal: AnnualGoalRecord = {
    id: existingGoal?.id ?? randomUUID(),
    fiscalYear,
    goalType: context.goalType,
    targetTeamId: context.targetTeamId,
    targetUserId: context.targetUserId,
    targetName: context.targetName,
    evaluationPeriodId: period.id,
    evaluationPeriodName: period.name,
    priorityTheme,
    currentAnalysis: normalizeText(input.currentAnalysis),
    annualGoal,
    grossProfitActions: normalizeText(input.grossProfitActions),
    developmentActions: normalizeText(input.developmentActions),
    kpi: normalizeText(input.kpi),
    midtermMemo: normalizeText(input.midtermMemo),
    analysisSnapshot: analysis,
    createdBy: existingGoal?.createdBy ?? sessionUser.id,
    createdByName: existingGoal?.createdByName ?? sessionUser.name,
    updatedBy: sessionUser.id,
    updatedByName: sessionUser.name,
    createdAt: existingGoal?.createdAt ?? now,
    updatedAt: now,
  };

  const nextGoals = [
    ...goals.filter((goal) => goal.id !== nextGoal.id),
    nextGoal,
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  await writeAnnualGoalFile(nextGoals);

  return {
    id: nextGoal.id,
    message: existingGoal ? "年度目標を更新しました。" : "年度目標を保存しました。",
  };
}

export function formatAnnualGoalJudgement(value: AnnualGoalJudgement) {
  return mapJudgementLabel(value);
}
