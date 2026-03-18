import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { calculateGrossProfit, type GrossProfitResult } from "@/lib/pl/calculations";
import { getTeamFixedCostAllocationSummary } from "@/lib/pl/fixed-cost-service";
import { getTeamLaborCostSummary } from "@/lib/pl/labor-cost-service";

export type TeamMonthlySnapshot = GrossProfitResult & {
  teamId: string;
  teamName: string;
  yearMonth: string;
  source: "manual" | "database" | "fallback";
};

export type VisibleTeamOption = {
  teamId: string;
  teamName: string;
};

export type VisibleYearMonthOption = {
  yearMonth: string;
};

export type TeamMonthlyInput = {
  teamId: string;
  yearMonth: string;
  salesTotal: number;
  directLaborCost: number;
  outsourcingCost: number;
  indirectCost: number;
  fixedCostAllocation: number;
  targetGrossProfitRate: number;
};

export type SaveTeamMonthlyResult = {
  persisted: boolean;
  snapshot: TeamMonthlySnapshot;
};

const fallbackSnapshots: TeamMonthlySnapshot[] = [
  {
    teamId: "team-platform",
    teamName: "プラットフォームチーム",
    yearMonth: "2026-03",
    salesTotal: 2450000,
    directLaborCost: 910000,
    outsourcingCost: 620000,
    grossProfit1: 920000,
    indirectCost: 120000,
    grossProfit2: 800000,
    fixedCostAllocation: 300000,
    finalGrossProfit: 500000,
    targetGrossProfitRate: 32,
    actualGrossProfitRate: 20.41,
    varianceAmount: -284000,
    varianceRate: -11.59,
    source: "fallback",
  },
  {
    teamId: "team-application",
    teamName: "アプリケーションチーム",
    yearMonth: "2026-03",
    salesTotal: 1980000,
    directLaborCost: 720000,
    outsourcingCost: 430000,
    grossProfit1: 830000,
    indirectCost: 110000,
    grossProfit2: 720000,
    fixedCostAllocation: 160000,
    finalGrossProfit: 560000,
    targetGrossProfitRate: 30,
    actualGrossProfitRate: 28.28,
    varianceAmount: -34000,
    varianceRate: -1.72,
    source: "fallback",
  },
];

function sumAmount<T extends { amount: unknown }>(rows: T[]): number {
  return rows.reduce((total, row) => total + Number(row.amount), 0);
}

function createSnapshot(teamId: string, teamName: string, yearMonth: string, source: TeamMonthlySnapshot["source"], values: GrossProfitResult): TeamMonthlySnapshot {
  return {
    teamId,
    teamName,
    yearMonth,
    source,
    ...values,
  };
}

type TeamMonthlyPlStatus = "DRAFT" | "CONFIRMED";

async function persistSnapshot(snapshot: TeamMonthlySnapshot, status: TeamMonthlyPlStatus) {
  await prisma.teamMonthlyPl.upsert({
    where: {
      teamId_yearMonth: {
        teamId: snapshot.teamId,
        yearMonth: snapshot.yearMonth,
      },
    },
    update: {
      salesTotal: snapshot.salesTotal,
      directLaborCost: snapshot.directLaborCost,
      outsourcingCost: snapshot.outsourcingCost,
      grossProfit1: snapshot.grossProfit1,
      indirectCost: snapshot.indirectCost,
      grossProfit2: snapshot.grossProfit2,
      fixedCostAllocation: snapshot.fixedCostAllocation,
      finalGrossProfit: snapshot.finalGrossProfit,
      targetGrossProfitRate: snapshot.targetGrossProfitRate,
      actualGrossProfitRate: snapshot.actualGrossProfitRate,
      varianceAmount: snapshot.varianceAmount,
      varianceRate: snapshot.varianceRate,
      status,
    },
    create: {
      teamId: snapshot.teamId,
      yearMonth: snapshot.yearMonth,
      salesTotal: snapshot.salesTotal,
      directLaborCost: snapshot.directLaborCost,
      outsourcingCost: snapshot.outsourcingCost,
      grossProfit1: snapshot.grossProfit1,
      indirectCost: snapshot.indirectCost,
      grossProfit2: snapshot.grossProfit2,
      fixedCostAllocation: snapshot.fixedCostAllocation,
      finalGrossProfit: snapshot.finalGrossProfit,
      targetGrossProfitRate: snapshot.targetGrossProfitRate,
      actualGrossProfitRate: snapshot.actualGrossProfitRate,
      varianceAmount: snapshot.varianceAmount,
      varianceRate: snapshot.varianceRate,
      status,
    },
  });
}

export async function getTeamMonthlySnapshot(teamId: string, yearMonth: string): Promise<TeamMonthlySnapshot> {
  if (!hasDatabaseUrl()) {
    const fallback = fallbackSnapshots.find((snapshot) => snapshot.teamId === teamId && snapshot.yearMonth === yearMonth);
    if (fallback) return fallback;

    return createSnapshot(teamId, "未登録チーム", yearMonth, "fallback", calculateGrossProfit({
      salesTotal: 0,
      directLaborCost: 0,
      outsourcingCost: 0,
      indirectCost: 0,
      fixedCostAllocation: 0,
      targetGrossProfitRate: 0,
    }));
  }

  try {
    const teamWithManual = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        teamMonthlyPls: {
          where: { yearMonth },
          take: 1,
        },
      },
    });

    const manual = teamWithManual?.teamMonthlyPls[0];
    if (teamWithManual && manual) {
      return createSnapshot(teamWithManual.id, teamWithManual.name, yearMonth, "manual", {
        salesTotal: Number(manual.salesTotal),
        directLaborCost: Number(manual.directLaborCost),
        outsourcingCost: Number(manual.outsourcingCost),
        grossProfit1: Number(manual.grossProfit1),
        indirectCost: Number(manual.indirectCost),
        grossProfit2: Number(manual.grossProfit2),
        fixedCostAllocation: Number(manual.fixedCostAllocation),
        finalGrossProfit: Number(manual.finalGrossProfit),
        targetGrossProfitRate: Number(manual.targetGrossProfitRate),
        actualGrossProfitRate: Number(manual.actualGrossProfitRate),
        varianceAmount: Number(manual.varianceAmount),
        varianceRate: Number(manual.varianceRate),
      });
    }

    const [team, fixedCostSummary, laborCostSummary] = await Promise.all([
      prisma.team.findUniqueOrThrow({
        where: { id: teamId },
        select: {
          id: true,
          name: true,
          assignments: { where: { yearMonth }, select: { salesAmount: true } },
          costs: { where: { yearMonth }, select: { amount: true, costCategory: true } },
          indirectCosts: { where: { yearMonth }, select: { amount: true } },
          targets: { where: { yearMonth }, select: { grossProfitRateTarget: true }, take: 1 },
        },
      }),
      getTeamFixedCostAllocationSummary(teamId, yearMonth),
      getTeamLaborCostSummary(teamId, yearMonth),
    ]);

    const salesTotal = team.assignments.reduce((total, row) => total + Number(row.salesAmount), 0);
    const directLaborCost = laborCostSummary.total;
    const outsourcingCost = sumAmount(team.costs.filter((row) => row.costCategory === "OUTSOURCING"));
    const indirectCost = sumAmount(team.indirectCosts);
    const fixedCostAllocation = fixedCostSummary.allocations.reduce((total, row) => total + row.allocatedAmount, 0);
    const targetGrossProfitRate = Number(team.targets[0]?.grossProfitRateTarget ?? 0);

    const calculated = calculateGrossProfit({
      salesTotal,
      directLaborCost,
      outsourcingCost,
      indirectCost,
      fixedCostAllocation,
      targetGrossProfitRate,
    });

    return createSnapshot(team.id, team.name, yearMonth, "database", calculated);
  } catch {
    const fallback = fallbackSnapshots.find((snapshot) => snapshot.teamId === teamId && snapshot.yearMonth === yearMonth);
    if (fallback) return fallback;

    return createSnapshot(teamId, "未登録チーム", yearMonth, "fallback", calculateGrossProfit({
      salesTotal: 0,
      directLaborCost: 0,
      outsourcingCost: 0,
      indirectCost: 0,
      fixedCostAllocation: 0,
      targetGrossProfitRate: 0,
    }));
  }
}

export async function getVisibleTeamMonthlySnapshots(yearMonth: string): Promise<TeamMonthlySnapshot[]> {
  if (!hasDatabaseUrl()) {
    return fallbackSnapshots.filter((snapshot) => snapshot.yearMonth === yearMonth);
  }

  try {
    const teams = await prisma.team.findMany({ where: { isActive: true }, select: { id: true }, orderBy: { name: "asc" } });
    if (teams.length === 0) return fallbackSnapshots.filter((snapshot) => snapshot.yearMonth === yearMonth);
    return Promise.all(teams.map((team) => getTeamMonthlySnapshot(team.id, yearMonth)));
  } catch {
    return fallbackSnapshots.filter((snapshot) => snapshot.yearMonth === yearMonth);
  }
}

export async function saveTeamMonthlyInput(input: TeamMonthlyInput): Promise<SaveTeamMonthlyResult> {
  const calculated = calculateGrossProfit({
    salesTotal: input.salesTotal,
    directLaborCost: input.directLaborCost,
    outsourcingCost: input.outsourcingCost,
    indirectCost: input.indirectCost,
    fixedCostAllocation: input.fixedCostAllocation,
    targetGrossProfitRate: input.targetGrossProfitRate,
  });

  if (!hasDatabaseUrl()) {
    const fallback = fallbackSnapshots.find((snapshot) => snapshot.teamId === input.teamId);
    return {
      persisted: false,
      snapshot: createSnapshot(input.teamId, fallback?.teamName ?? "未登録チーム", input.yearMonth, "manual", calculated),
    };
  }

  try {
    const team = await prisma.team.findUniqueOrThrow({ where: { id: input.teamId }, select: { id: true, name: true } });
    const snapshot = createSnapshot(team.id, team.name, input.yearMonth, "manual", calculated);
    await persistSnapshot(snapshot, "DRAFT");
    return { persisted: true, snapshot };
  } catch {
    const fallback = fallbackSnapshots.find((snapshot) => snapshot.teamId === input.teamId);
    return {
      persisted: false,
      snapshot: createSnapshot(input.teamId, fallback?.teamName ?? "未登録チーム", input.yearMonth, "manual", calculated),
    };
  }
}

export async function recalculateTeamMonthlyPl(teamId: string, yearMonth: string): Promise<TeamMonthlySnapshot> {
  const snapshot = await (async () => {
    try {
      await prisma.teamMonthlyPl.deleteMany({ where: { teamId, yearMonth } });
    } catch {}
    return getTeamMonthlySnapshot(teamId, yearMonth);
  })();

  try {
    await persistSnapshot(snapshot, "CONFIRMED");
  } catch {
    return snapshot;
  }

  return { ...snapshot, source: "manual" };
}

export async function recalculateAllTeamMonthlyPl(yearMonth: string): Promise<TeamMonthlySnapshot[]> {
  if (!hasDatabaseUrl()) {
    return fallbackSnapshots.filter((snapshot) => snapshot.yearMonth === yearMonth);
  }

  const teams = await prisma.team.findMany({ where: { isActive: true }, select: { id: true } }).catch(() => []);
  return Promise.all(teams.map((team) => recalculateTeamMonthlyPl(team.id, yearMonth)));
}

export async function getVisibleTeamOptions(teamIds?: string[]): Promise<VisibleTeamOption[]> {
  if (!hasDatabaseUrl()) {
    return fallbackSnapshots.map((snapshot) => ({ teamId: snapshot.teamId, teamName: snapshot.teamName }));
  }

  try {
    const teams = await prisma.team.findMany({
      where: {
        isActive: true,
        ...(teamIds && teamIds.length > 0 ? { id: { in: teamIds } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    if (teams.length > 0) {
      return teams.map((team) => ({ teamId: team.id, teamName: team.name }));
    }
  } catch {}

  return fallbackSnapshots.map((snapshot) => ({ teamId: snapshot.teamId, teamName: snapshot.teamName }));
}

export async function getVisibleYearMonthOptions(teamId?: string): Promise<VisibleYearMonthOption[]> {
  if (!hasDatabaseUrl()) {
    return Array.from(new Set(fallbackSnapshots.map((snapshot) => snapshot.yearMonth))).sort((a, b) => b.localeCompare(a)).map((yearMonth) => ({ yearMonth }));
  }

  try {
    const [pls, assignments, indirectCosts, targets] = await Promise.all([
      prisma.teamMonthlyPl.findMany({
        where: teamId ? { teamId } : undefined,
        select: { yearMonth: true },
        distinct: ["yearMonth"],
        orderBy: { yearMonth: "desc" },
      }),
      prisma.monthlyAssignment.findMany({
        where: teamId ? { teamId } : undefined,
        select: { yearMonth: true },
        distinct: ["yearMonth"],
        orderBy: { yearMonth: "desc" },
      }),
      prisma.teamIndirectCost.findMany({
        where: teamId ? { teamId } : undefined,
        select: { yearMonth: true },
        distinct: ["yearMonth"],
        orderBy: { yearMonth: "desc" },
      }),
      prisma.teamTarget.findMany({
        where: teamId ? { teamId } : undefined,
        select: { yearMonth: true },
        distinct: ["yearMonth"],
        orderBy: { yearMonth: "desc" },
      }),
    ]);

    const values = Array.from(
      new Set([...pls, ...assignments, ...indirectCosts, ...targets].map((row) => row.yearMonth)),
    ).sort((a, b) => b.localeCompare(a));

    if (values.length > 0) {
      return values.map((yearMonth) => ({ yearMonth }));
    }
  } catch {}

  return Array.from(new Set(fallbackSnapshots.map((snapshot) => snapshot.yearMonth))).sort((a, b) => b.localeCompare(a)).map((yearMonth) => ({ yearMonth }));
}
