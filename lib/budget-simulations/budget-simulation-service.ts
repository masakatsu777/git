import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getEvaluationPeriodOptions } from "@/lib/evaluations/period-service";
import { roundCurrency } from "@/lib/format/currency";
import { getProfitBreakdownBundle, type ProfitBreakdownRow } from "@/lib/pl/profit-breakdown-service";
import { getVisibleTeamMonthlySnapshots } from "@/lib/pl/service";

type BudgetSimulationSubjectFilter = "ALL" | "EMPLOYEE" | "PARTNER";
type BudgetSimulationMembershipFilter = "ALL" | "ASSIGNED" | "UNASSIGNED";

export type BudgetSimulationFilters = {
  departmentId: string;
  teamId: string;
  subjectType: BudgetSimulationSubjectFilter;
  membershipFilter: BudgetSimulationMembershipFilter;
};

export type BudgetSimulationWarningCode =
  | "BUDGET_OVER"
  | "NEGATIVE_GROSS_PROFIT"
  | "BELOW_TARGET_RATE"
  | "COST_OVER_SALES";

export type BudgetSimulationSubjectSummary = {
  count: number;
  salesTotal: number;
  directLaborCost: number;
  outsourcingCost: number;
  finalGrossProfit: number;
};

export type BudgetSimulationRow = {
  key: string;
  subjectType: "EMPLOYEE" | "PARTNER";
  membershipStatus: "ASSIGNED" | "UNASSIGNED" | "PARTNER";
  entityId: string;
  employeeName: string;
  secondaryLabel: string;
  departmentName: string;
  teamName: string;
  currentUnitPrice: number;
  assumedUnitPrice: number;
  currentDirectLaborCost: number;
  assumedDirectLaborCost: number;
  currentOutsourcingCost: number;
  assumedOutsourcingCost: number;
  indirectCostAllocation: number;
  fixedCostAllocation: number;
  currentSalesAmount: number;
  assumedSalesAmount: number;
  assumedGrossProfit: number;
  assumedGrossProfitRate: number;
  targetGrossProfitRate: number;
  memo: string;
  warningCodes: BudgetSimulationWarningCode[];
};

export type BudgetSimulationSummary = {
  headcount: number;
  totalCurrentLaborCost: number;
  totalAssumedLaborCost: number;
  totalCurrentOutsourcingCost: number;
  totalAssumedOutsourcingCost: number;
  totalRaiseAmount: number;
  budgetRemaining: number;
  totalCurrentSalesAmount: number;
  totalAssumedSalesAmount: number;
  totalIndirectCostAllocation: number;
  totalFixedCostAllocation: number;
  totalAssumedGrossProfit: number;
  totalAssumedGrossProfitRate: number;
  rowsWithWarnings: number;
  employeeSummary: BudgetSimulationSubjectSummary;
  partnerSummary: BudgetSimulationSubjectSummary;
};

export type BudgetSimulationBundle = {
  yearMonth: string;
  budgetTotal: number;
  note: string;
  evaluationPeriodId?: string;
  filters: BudgetSimulationFilters;
  departmentOptions: Array<{ id: string; name: string }>;
  teamOptions: Array<{ id: string; name: string; departmentId: string }>;
  rows: BudgetSimulationRow[];
  summary: BudgetSimulationSummary;
  source: "database" | "fallback";
};

export type SaveBudgetSimulationInput = {
  yearMonth: string;
  budgetTotal: number;
  note: string;
  evaluationPeriodId?: string;
  rows: Array<{
    key: string;
    assumedUnitPrice: number;
    assumedDirectLaborCost: number;
    assumedOutsourcingCost: number;
    memo: string;
  }>;
};

type StoredSimulationRow = {
  assumedUnitPrice?: number;
  assumedDirectLaborCost?: number;
  assumedOutsourcingCost?: number;
  memo?: string;
};

type StoredSimulation = {
  budgetTotal?: number;
  note?: string;
  evaluationPeriodId?: string;
  rows?: Record<string, StoredSimulationRow>;
};

type StoredSimulationFile = {
  simulations?: Record<string, StoredSimulation>;
};

type BaseBudgetSimulationRow = {
  key: string;
  subjectType: "EMPLOYEE" | "PARTNER";
  membershipStatus: "ASSIGNED" | "UNASSIGNED" | "PARTNER";
  entityId: string;
  employeeName: string;
  secondaryLabel: string;
  departmentName: string;
  teamName: string;
  currentUnitPrice: number;
  currentDirectLaborCost: number;
  currentOutsourcingCost: number;
  indirectCostAllocation: number;
  fixedCostAllocation: number;
  currentSalesAmount: number;
  targetGrossProfitRate: number;
};

const simulationStorePath = path.join(process.cwd(), "data", "settings", "budget-simulations.json");

function roundRate(value: number) {
  return Math.round(value * 100) / 100;
}

function formatYearMonth(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getCurrentYearMonth() {
  return formatYearMonth(new Date());
}

async function readSimulationStore(): Promise<StoredSimulationFile> {
  try {
    const raw = await readFile(simulationStorePath, "utf8");
    return JSON.parse(raw) as StoredSimulationFile;
  } catch {
    return { simulations: {} };
  }
}

async function writeSimulationStore(store: StoredSimulationFile) {
  await mkdir(path.dirname(simulationStorePath), { recursive: true });
  await writeFile(simulationStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function buildWarnings(row: Omit<BudgetSimulationRow, "warningCodes">, budgetRemaining: number): BudgetSimulationWarningCode[] {
  const warnings: BudgetSimulationWarningCode[] = [];

  if (budgetRemaining < 0) {
    warnings.push("BUDGET_OVER");
  }
  if (row.assumedGrossProfit < 0) {
    warnings.push("NEGATIVE_GROSS_PROFIT");
  }
  if (row.assumedGrossProfitRate < row.targetGrossProfitRate) {
    warnings.push("BELOW_TARGET_RATE");
  }
  if (row.assumedSalesAmount < row.assumedDirectLaborCost + row.assumedOutsourcingCost + row.indirectCostAllocation + row.fixedCostAllocation) {
    warnings.push("COST_OVER_SALES");
  }

  return warnings;
}

function buildRow(base: BaseBudgetSimulationRow, saved?: StoredSimulationRow, budgetRemaining = 0): BudgetSimulationRow {
  const assumedUnitPrice = roundCurrency(saved?.assumedUnitPrice ?? base.currentUnitPrice);
  const assumedDirectLaborCost = roundCurrency(saved?.assumedDirectLaborCost ?? base.currentDirectLaborCost);
  const assumedOutsourcingCost = roundCurrency(saved?.assumedOutsourcingCost ?? base.currentOutsourcingCost);
  const assumedSalesAmount = assumedUnitPrice;
  const assumedGrossProfit = roundCurrency(
    assumedSalesAmount -
      assumedDirectLaborCost -
      assumedOutsourcingCost -
      base.indirectCostAllocation -
      base.fixedCostAllocation,
  );
  const assumedGrossProfitRate = assumedSalesAmount === 0 ? 0 : roundRate((assumedGrossProfit / assumedSalesAmount) * 100);
  const rowWithoutWarnings = {
    key: base.key,
    subjectType: base.subjectType,
    membershipStatus: base.membershipStatus,
    entityId: base.entityId,
    employeeName: base.employeeName,
    secondaryLabel: base.secondaryLabel,
    departmentName: base.departmentName,
    teamName: base.teamName,
    currentUnitPrice: base.currentUnitPrice,
    assumedUnitPrice,
    currentDirectLaborCost: base.currentDirectLaborCost,
    assumedDirectLaborCost,
    currentOutsourcingCost: base.currentOutsourcingCost,
    assumedOutsourcingCost,
    indirectCostAllocation: base.indirectCostAllocation,
    fixedCostAllocation: base.fixedCostAllocation,
    currentSalesAmount: base.currentSalesAmount,
    assumedSalesAmount,
    assumedGrossProfit,
    assumedGrossProfitRate,
    targetGrossProfitRate: base.targetGrossProfitRate,
    memo: String(saved?.memo ?? "").trim(),
  };

  return {
    ...rowWithoutWarnings,
    warningCodes: buildWarnings(rowWithoutWarnings, budgetRemaining),
  };
}

function summarizeSubject(rows: BudgetSimulationRow[], subjectType: "EMPLOYEE" | "PARTNER"): BudgetSimulationSubjectSummary {
  const filtered = rows.filter((row) => row.subjectType === subjectType);
  return {
    count: filtered.length,
    salesTotal: filtered.reduce((sum, row) => sum + row.assumedSalesAmount, 0),
    directLaborCost: filtered.reduce((sum, row) => sum + row.assumedDirectLaborCost, 0),
    outsourcingCost: filtered.reduce((sum, row) => sum + row.assumedOutsourcingCost, 0),
    finalGrossProfit: filtered.reduce((sum, row) => sum + row.assumedGrossProfit, 0),
  };
}

function summarizeRows(rows: BudgetSimulationRow[], budgetTotal: number): BudgetSimulationSummary {
  const totalCurrentLaborCost = rows.reduce((sum, row) => sum + row.currentDirectLaborCost, 0);
  const totalAssumedLaborCost = rows.reduce((sum, row) => sum + row.assumedDirectLaborCost, 0);
  const totalCurrentOutsourcingCost = rows.reduce((sum, row) => sum + row.currentOutsourcingCost, 0);
  const totalAssumedOutsourcingCost = rows.reduce((sum, row) => sum + row.assumedOutsourcingCost, 0);
  const totalCurrentSalesAmount = rows.reduce((sum, row) => sum + row.currentSalesAmount, 0);
  const totalAssumedSalesAmount = rows.reduce((sum, row) => sum + row.assumedSalesAmount, 0);
  const totalIndirectCostAllocation = rows.reduce((sum, row) => sum + row.indirectCostAllocation, 0);
  const totalFixedCostAllocation = rows.reduce((sum, row) => sum + row.fixedCostAllocation, 0);
  const totalAssumedGrossProfit = rows.reduce((sum, row) => sum + row.assumedGrossProfit, 0);
  const totalRaiseAmount = rows
    .filter((row) => row.subjectType === "EMPLOYEE")
    .reduce((sum, row) => sum + (row.assumedDirectLaborCost - row.currentDirectLaborCost), 0);

  return {
    headcount: rows.length,
    totalCurrentLaborCost,
    totalAssumedLaborCost,
    totalCurrentOutsourcingCost,
    totalAssumedOutsourcingCost,
    totalRaiseAmount,
    budgetRemaining: roundCurrency(budgetTotal - totalRaiseAmount),
    totalCurrentSalesAmount,
    totalAssumedSalesAmount,
    totalIndirectCostAllocation,
    totalFixedCostAllocation,
    totalAssumedGrossProfit,
    totalAssumedGrossProfitRate: totalAssumedSalesAmount === 0 ? 0 : roundRate((totalAssumedGrossProfit / totalAssumedSalesAmount) * 100),
    rowsWithWarnings: rows.filter((row) => row.warningCodes.length > 0).length,
    employeeSummary: summarizeSubject(rows, "EMPLOYEE"),
    partnerSummary: summarizeSubject(rows, "PARTNER"),
  };
}

function fallbackBaseRows(): BaseBudgetSimulationRow[] {
  return [
    {
      key: "demo-leader:team-platform",
      subjectType: "EMPLOYEE",
      membershipStatus: "ASSIGNED",
      entityId: "demo-leader",
      employeeName: "主任 次郎",
      secondaryLabel: "E1001",
      departmentName: "開発部",
      teamName: "プラットフォームチーム",
      currentUnitPrice: 1225000,
      currentDirectLaborCost: 540000,
      currentOutsourcingCost: 0,
      indirectCostAllocation: 0,
      fixedCostAllocation: 470000,
      currentSalesAmount: 1225000,
      targetGrossProfitRate: 32,
    },
    {
      key: "demo-member1:team-platform",
      subjectType: "EMPLOYEE",
      membershipStatus: "ASSIGNED",
      entityId: "demo-member1",
      employeeName: "開発 一郎",
      secondaryLabel: "E1002",
      departmentName: "開発部",
      teamName: "プラットフォームチーム",
      currentUnitPrice: 1225000,
      currentDirectLaborCost: 370000,
      currentOutsourcingCost: 0,
      indirectCostAllocation: 0,
      fixedCostAllocation: 470000,
      currentSalesAmount: 1225000,
      targetGrossProfitRate: 32,
    },
    {
      key: "partner-001:team-platform",
      subjectType: "PARTNER",
      membershipStatus: "PARTNER",
      entityId: "partner-001",
      employeeName: "協力会社A",
      secondaryLabel: "株式会社A",
      departmentName: "開発部",
      teamName: "プラットフォームチーム",
      currentUnitPrice: 700000,
      currentDirectLaborCost: 0,
      currentOutsourcingCost: 620000,
      indirectCostAllocation: 0,
      fixedCostAllocation: 0,
      currentSalesAmount: 700000,
      targetGrossProfitRate: 0,
    },
  ];
}

function toBaseRow(row: ProfitBreakdownRow, targetGrossProfitRate: number): BaseBudgetSimulationRow {
  return {
    key: row.key,
    subjectType: row.subjectType,
    membershipStatus: row.membershipStatus,
    entityId: row.entityId,
    employeeName: row.displayName,
    secondaryLabel: row.secondaryLabel,
    departmentName: row.departmentName,
    teamName: row.teamName,
    currentUnitPrice: row.salesTotal,
    currentDirectLaborCost: row.directLaborCost,
    currentOutsourcingCost: row.outsourcingCost,
    indirectCostAllocation: row.indirectCostAllocation,
    fixedCostAllocation: row.fixedCostAllocation,
    currentSalesAmount: row.salesTotal,
    targetGrossProfitRate,
  };
}

type BuildBaseRowsInput = {
  yearMonth: string;
  departmentId?: string;
  teamId?: string;
  subjectType?: BudgetSimulationSubjectFilter;
  membershipFilter?: BudgetSimulationMembershipFilter;
};

async function buildBaseRows(input: BuildBaseRowsInput): Promise<{
  rows: BaseBudgetSimulationRow[];
  source: "database" | "fallback";
  filters: BudgetSimulationFilters;
  departmentOptions: Array<{ id: string; name: string }>;
  teamOptions: Array<{ id: string; name: string; departmentId: string }>;
}> {
  const resolvedFilters: BudgetSimulationFilters = {
    departmentId: input.departmentId ?? "",
    teamId: input.teamId ?? "",
    subjectType: input.subjectType ?? "ALL",
    membershipFilter: input.membershipFilter ?? "ALL",
  };
  const [breakdownBundle, snapshots] = await Promise.all([
    getProfitBreakdownBundle({
      rangeStartYearMonth: input.yearMonth,
      rangeEndYearMonth: input.yearMonth,
      departmentId: resolvedFilters.departmentId || undefined,
      teamId: resolvedFilters.teamId || undefined,
      subjectType: resolvedFilters.subjectType,
      membershipFilter: resolvedFilters.membershipFilter,
    }),
    getVisibleTeamMonthlySnapshots(input.yearMonth),
  ]);

  if (breakdownBundle.rows.length === 0) {
    return {
      rows: fallbackBaseRows(),
      source: "fallback",
      filters: resolvedFilters,
      departmentOptions: breakdownBundle.departmentOptions,
      teamOptions: breakdownBundle.teamOptions,
    };
  }

  const targetRateByTeamId = new Map(
    snapshots.map((snapshot) => [snapshot.teamId, snapshot.targetGrossProfitRate] as const),
  );
  const rows = breakdownBundle.rows.map((row) => toBaseRow(row, row.teamId ? (targetRateByTeamId.get(row.teamId) ?? 0) : 0));

  return {
    rows,
    source: snapshots.some((snapshot) => snapshot.source === "database") ? "database" : "fallback",
    filters: resolvedFilters,
    departmentOptions: breakdownBundle.departmentOptions,
    teamOptions: breakdownBundle.teamOptions,
  };
}

function defaultBudgetTotal(rows: BaseBudgetSimulationRow[]) {
  return rows
    .filter((row) => row.subjectType === "EMPLOYEE")
    .reduce((sum, row) => sum + roundCurrency(row.currentDirectLaborCost * 0.05), 0);
}

function applyBudgetWarnings(rows: BudgetSimulationRow[], budgetTotal: number) {
  const totalRaiseAmount = rows
    .filter((row) => row.subjectType === "EMPLOYEE")
    .reduce((sum, row) => sum + (row.assumedDirectLaborCost - row.currentDirectLaborCost), 0);
  const budgetRemaining = roundCurrency(budgetTotal - totalRaiseAmount);
  return rows.map((row) => buildRow({
    key: row.key,
    subjectType: row.subjectType,
    membershipStatus: row.membershipStatus,
    entityId: row.entityId,
    employeeName: row.employeeName,
    secondaryLabel: row.secondaryLabel,
    departmentName: row.departmentName,
    teamName: row.teamName,
    currentUnitPrice: row.currentUnitPrice,
    currentDirectLaborCost: row.currentDirectLaborCost,
    currentOutsourcingCost: row.currentOutsourcingCost,
    indirectCostAllocation: row.indirectCostAllocation,
    fixedCostAllocation: row.fixedCostAllocation,
    currentSalesAmount: row.currentSalesAmount,
    targetGrossProfitRate: row.targetGrossProfitRate,
  }, {
    assumedUnitPrice: row.assumedUnitPrice,
    assumedDirectLaborCost: row.assumedDirectLaborCost,
    assumedOutsourcingCost: row.assumedOutsourcingCost,
    memo: row.memo,
  }, budgetRemaining));
}

export async function getBudgetSimulationBundle(input?: BuildBaseRowsInput): Promise<BudgetSimulationBundle> {
  const resolvedYearMonth = input?.yearMonth ?? getCurrentYearMonth();
  const [base, store, periods] = await Promise.all([
    buildBaseRows({
      yearMonth: resolvedYearMonth,
      departmentId: input?.departmentId,
      teamId: input?.teamId,
      subjectType: input?.subjectType,
      membershipFilter: input?.membershipFilter,
    }),
    readSimulationStore(),
    getEvaluationPeriodOptions(),
  ]);
  const saved = store.simulations?.[resolvedYearMonth];
  const budgetTotal = roundCurrency(saved?.budgetTotal ?? defaultBudgetTotal(base.rows));
  const evaluationPeriodId = saved?.evaluationPeriodId ?? periods[0]?.id;
  const rows = applyBudgetWarnings(
    base.rows
      .map((row) => buildRow(row, saved?.rows?.[row.key]))
      .sort((left, right) => {
        if (left.subjectType !== right.subjectType) {
          return left.subjectType.localeCompare(right.subjectType);
        }
        if (left.departmentName !== right.departmentName) {
          return left.departmentName.localeCompare(right.departmentName, "ja");
        }
        if (left.teamName !== right.teamName) {
          return left.teamName.localeCompare(right.teamName, "ja");
        }
        return left.employeeName.localeCompare(right.employeeName, "ja");
      }),
    budgetTotal,
  );

  return {
    yearMonth: resolvedYearMonth,
    budgetTotal,
    note: String(saved?.note ?? ""),
    evaluationPeriodId,
    filters: base.filters,
    departmentOptions: base.departmentOptions,
    teamOptions: base.teamOptions,
    rows,
    summary: summarizeRows(rows, budgetTotal),
    source: base.source,
  };
}

export async function saveBudgetSimulationBundle(input: SaveBudgetSimulationInput): Promise<BudgetSimulationBundle> {
  const yearMonth = input.yearMonth || getCurrentYearMonth();
  const store = await readSimulationStore();
  const current = store.simulations ?? {};
  const existingRows = current[yearMonth]?.rows ?? {};

  current[yearMonth] = {
    budgetTotal: roundCurrency(input.budgetTotal),
    note: String(input.note ?? "").trim(),
    evaluationPeriodId: input.evaluationPeriodId,
    rows: {
      ...existingRows,
      ...Object.fromEntries(
      input.rows.map((row) => [
        row.key,
        {
          assumedUnitPrice: roundCurrency(row.assumedUnitPrice),
          assumedDirectLaborCost: roundCurrency(row.assumedDirectLaborCost),
          assumedOutsourcingCost: roundCurrency(row.assumedOutsourcingCost),
          memo: String(row.memo ?? "").trim(),
        },
      ]),
      ),
    },
  };

  await writeSimulationStore({ simulations: current });
  return getBudgetSimulationBundle({ yearMonth });
}
