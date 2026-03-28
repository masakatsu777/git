import { prisma } from "@/lib/prisma";
import { getTeamMonthlySnapshot, getVisibleTeamOptions, getVisibleYearMonthOptions, saveMonthlyTargetRates, type TeamMonthlySnapshot } from "@/lib/pl/service";

export type FiscalYearOption = {
  fiscalYear: number;
  label: string;
};

export type FiscalStartMonthOption = {
  month: number;
  label: string;
};

export type TeamAnnualSnapshot = {
  teamId: string;
  teamName: string;
  fiscalYear: number;
  fiscalStartMonth: number;
  salesTotal: number;
  directLaborCost: number;
  outsourcingCost: number;
  indirectCost: number;
  fixedCostAllocation: number;
  finalGrossProfit: number;
  grossProfitRate: number;
  targetGrossProfitRate: number;
  varianceRate: number;
  coveredMonths: string[];
  previousSalesTotal: number;
  previousFinalGrossProfit: number;
  salesYoYRate: number;
  grossProfitYoYRate: number;
};

export type AnnualDashboardTotals = {
  salesTotal: number;
  finalGrossProfit: number;
  grossProfitRate: number;
  targetGrossProfitRate: number;
  varianceRate: number;
  previousSalesTotal: number;
  previousFinalGrossProfit: number;
  salesYoYRate: number;
  grossProfitYoYRate: number;
};

export type TeamAnnualComparisonRow = {
  fiscalYear: number;
  fiscalYearLabel: string;
  teamId: string;
  teamName: string;
  salesTotal: number;
  finalGrossProfit: number;
  grossProfitRate: number;
  targetGrossProfitRate: number;
  varianceRate: number;
  salesYoYRate: number;
  grossProfitYoYRate: number;
};

export type AnnualComparisonRow = {
  fiscalYear: number;
  fiscalYearLabel: string;
  salesTotal: number;
  finalGrossProfit: number;
  grossProfitRate: number;
  targetGrossProfitRate: number;
  varianceRate: number;
  salesYoYRate: number;
  grossProfitYoYRate: number;
};


export type SaveAnnualTargetRateInput = {
  fiscalYear: number;
  fiscalStartMonth: number;
  targetGrossProfitRate: number;
};

export type AnnualDashboardBundle = {
  fiscalYear: number;
  fiscalYearLabel: string;
  fiscalStartMonth: number;
  fiscalStartMonthLabel: string;
  options: FiscalYearOption[];
  fiscalStartMonthOptions: FiscalStartMonthOption[];
  summaries: TeamAnnualSnapshot[];
  totals: AnnualDashboardTotals;
  coveredMonths: string[];
  previousCoveredMonths: string[];
  comparisonRows: AnnualComparisonRow[];
  selectedTeamId: string | null;
  selectedTeamName: string | null;
  teamComparisonRows: TeamAnnualComparisonRow[];
  rangeStartYearMonth: string;
  rangeEndYearMonth: string;
  rangeOptions: string[];
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function calcYoYRate(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return round2(((current - previous) / previous) * 100);
}

function toFiscalYear(yearMonth: string, fiscalStartMonth: number) {
  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return month >= fiscalStartMonth ? year : year - 1;
}

function buildFiscalYearLabel(fiscalYear: number, fiscalStartMonth: number) {
  const endMonth = fiscalStartMonth === 1 ? 12 : fiscalStartMonth - 1;
  return `${fiscalYear}年度 (${String(fiscalStartMonth).padStart(2, "0")}月開始 - ${String(endMonth).padStart(2, "0")}月締め)`;
}

function buildFiscalStartMonthLabel(month: number) {
  return `${String(month).padStart(2, "0")}月開始`;
}

function buildFiscalYearMonths(fiscalYear: number, fiscalStartMonth: number) {
  const months: string[] = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const monthIndex = fiscalStartMonth + offset;
    const year = monthIndex <= 12 ? fiscalYear : fiscalYear + 1;
    const month = monthIndex <= 12 ? monthIndex : monthIndex - 12;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

function shiftYearMonth(yearMonth: string, yearDelta: number) {
  const [yearText, monthText] = yearMonth.split("-");
  return `${Number(yearText) + yearDelta}-${monthText}`;
}

function normalizeRange(options: string[], requestedStart?: string, requestedEnd?: string) {
  const sortedOptions = [...options].sort((a, b) => a.localeCompare(b));
  const fallbackStart = sortedOptions[0] ?? new Date().toISOString().slice(0, 7);
  const fallbackEnd = sortedOptions[sortedOptions.length - 1] ?? fallbackStart;
  let start = requestedStart && sortedOptions.includes(requestedStart) ? requestedStart : fallbackStart;
  let end = requestedEnd && sortedOptions.includes(requestedEnd) ? requestedEnd : fallbackEnd;
  if (start.localeCompare(end) > 0) {
    [start, end] = [end, start];
  }
  const months = sortedOptions.filter((yearMonth) => yearMonth.localeCompare(start) >= 0 && yearMonth.localeCompare(end) <= 0);
  return {
    start: months[0] ?? start,
    end: months[months.length - 1] ?? end,
    months: months.length > 0 ? months : [start],
  };
}

function sumSnapshots(
  teamId: string,
  teamName: string,
  fiscalYear: number,
  fiscalStartMonth: number,
  currentRows: TeamMonthlySnapshot[],
  previousRows: TeamMonthlySnapshot[],
): TeamAnnualSnapshot {
  const salesTotal = currentRows.reduce((sum, row) => sum + row.salesTotal, 0);
  const directLaborCost = currentRows.reduce((sum, row) => sum + row.directLaborCost, 0);
  const outsourcingCost = currentRows.reduce((sum, row) => sum + row.outsourcingCost, 0);
  const indirectCost = currentRows.reduce((sum, row) => sum + row.indirectCost, 0);
  const fixedCostAllocation = currentRows.reduce((sum, row) => sum + row.fixedCostAllocation, 0);
  const finalGrossProfit = currentRows.reduce((sum, row) => sum + row.finalGrossProfit, 0);
  const targetGrossProfitRate = currentRows.length > 0 ? round2(currentRows.reduce((sum, row) => sum + row.targetGrossProfitRate, 0) / currentRows.length) : 0;
  const grossProfitRate = salesTotal === 0 ? 0 : round2((finalGrossProfit / salesTotal) * 100);
  const varianceRate = round2(grossProfitRate - targetGrossProfitRate);
  const previousSalesTotal = previousRows.reduce((sum, row) => sum + row.salesTotal, 0);
  const previousFinalGrossProfit = previousRows.reduce((sum, row) => sum + row.finalGrossProfit, 0);

  return {
    teamId,
    teamName,
    fiscalYear,
    fiscalStartMonth,
    salesTotal,
    directLaborCost,
    outsourcingCost,
    indirectCost,
    fixedCostAllocation,
    finalGrossProfit,
    grossProfitRate,
    targetGrossProfitRate,
    varianceRate,
    coveredMonths: currentRows.map((row) => row.yearMonth),
    previousSalesTotal,
    previousFinalGrossProfit,
    salesYoYRate: calcYoYRate(salesTotal, previousSalesTotal),
    grossProfitYoYRate: calcYoYRate(finalGrossProfit, previousFinalGrossProfit),
  };
}

function toTeamComparisonRow(fiscalYear: number, fiscalStartMonth: number, row: TeamAnnualSnapshot): TeamAnnualComparisonRow {
  return {
    fiscalYear,
    fiscalYearLabel: buildFiscalYearLabel(fiscalYear, fiscalStartMonth),
    teamId: row.teamId,
    teamName: row.teamName,
    salesTotal: row.salesTotal,
    finalGrossProfit: row.finalGrossProfit,
    grossProfitRate: row.grossProfitRate,
    targetGrossProfitRate: row.targetGrossProfitRate,
    varianceRate: row.varianceRate,
    salesYoYRate: row.salesYoYRate,
    grossProfitYoYRate: row.grossProfitYoYRate,
  };
}

function toComparisonRow(fiscalYear: number, fiscalStartMonth: number, totals: AnnualDashboardTotals): AnnualComparisonRow {
  return {
    fiscalYear,
    fiscalYearLabel: buildFiscalYearLabel(fiscalYear, fiscalStartMonth),
    salesTotal: totals.salesTotal,
    finalGrossProfit: totals.finalGrossProfit,
    grossProfitRate: totals.grossProfitRate,
    targetGrossProfitRate: totals.targetGrossProfitRate,
    varianceRate: totals.varianceRate,
    salesYoYRate: totals.salesYoYRate,
    grossProfitYoYRate: totals.grossProfitYoYRate,
  };
}

function sumTotals(rows: TeamAnnualSnapshot[]): AnnualDashboardTotals {
  const salesTotal = rows.reduce((sum, row) => sum + row.salesTotal, 0);
  const finalGrossProfit = rows.reduce((sum, row) => sum + row.finalGrossProfit, 0);
  const previousSalesTotal = rows.reduce((sum, row) => sum + row.previousSalesTotal, 0);
  const previousFinalGrossProfit = rows.reduce((sum, row) => sum + row.previousFinalGrossProfit, 0);
  const targetGrossProfitRate = rows.length > 0 ? round2(rows.reduce((sum, row) => sum + row.targetGrossProfitRate, 0) / rows.length) : 0;
  const grossProfitRate = salesTotal === 0 ? 0 : round2((finalGrossProfit / salesTotal) * 100);

  return {
    salesTotal,
    finalGrossProfit,
    grossProfitRate,
    targetGrossProfitRate,
    varianceRate: round2(grossProfitRate - targetGrossProfitRate),
    previousSalesTotal,
    previousFinalGrossProfit,
    salesYoYRate: calcYoYRate(salesTotal, previousSalesTotal),
    grossProfitYoYRate: calcYoYRate(finalGrossProfit, previousFinalGrossProfit),
  };
}

export async function getAnnualDashboardBundle(
  fiscalYear?: number,
  fiscalStartMonth?: number,
  visibleTeamIds?: string[],
  selectedTeamId?: string,
  rangeStartYearMonth?: string,
  rangeEndYearMonth?: string,
): Promise<AnnualDashboardBundle> {
  const resolvedFiscalStartMonth = fiscalStartMonth && fiscalStartMonth >= 1 && fiscalStartMonth <= 12 ? fiscalStartMonth : 4;
  const yearMonthOptions = await getVisibleYearMonthOptions(visibleTeamIds && visibleTeamIds.length > 0 ? visibleTeamIds : undefined);
  const fiscalYears = Array.from(new Set(yearMonthOptions.map((option) => toFiscalYear(option.yearMonth, resolvedFiscalStartMonth)))).sort((a, b) => b - a);
  const resolvedFiscalYear = fiscalYear ?? fiscalYears[0] ?? new Date().getFullYear();
  const fiscalMonths = buildFiscalYearMonths(resolvedFiscalYear, resolvedFiscalStartMonth);
  const normalizedRange = normalizeRange(fiscalMonths, rangeStartYearMonth, rangeEndYearMonth);
  const months = normalizedRange.months;
  const previousMonths = months.map((yearMonth) => shiftYearMonth(yearMonth, -1));
  const previousPreviousMonths = months.map((yearMonth) => shiftYearMonth(yearMonth, -2));
  const teams = await getVisibleTeamOptions(visibleTeamIds);
  const resolvedSelectedTeamId = selectedTeamId && teams.some((team) => team.teamId === selectedTeamId) ? selectedTeamId : teams[0]?.teamId ?? null;
  const resolvedSelectedTeamName = resolvedSelectedTeamId ? teams.find((team) => team.teamId === resolvedSelectedTeamId)?.teamName ?? null : null;

  async function buildRangeSummary(targetFiscalYear: number, targetMonths: string[], targetPreviousMonths: string[]) {
    const yearSummaries = await Promise.all(
      teams.map(async (team) => {
        const [existingCurrentMonths, existingPreviousMonths] = await Promise.all([
          prisma.teamMonthlyPl.findMany({
            where: {
              teamId: team.teamId,
              yearMonth: { in: targetMonths },
            },
            select: { yearMonth: true },
            orderBy: { yearMonth: "asc" },
          }),
          prisma.teamMonthlyPl.findMany({
            where: {
              teamId: team.teamId,
              yearMonth: { in: targetPreviousMonths },
            },
            select: { yearMonth: true },
            orderBy: { yearMonth: "asc" },
          }),
        ]);

        const currentMonths = existingCurrentMonths.map((row) => row.yearMonth);
        const previousMonthsForTeam = existingPreviousMonths.map((row) => row.yearMonth);

        const [snapshots, previousSnapshots] = await Promise.all([
          Promise.all(currentMonths.map((yearMonth) => getTeamMonthlySnapshot(team.teamId, yearMonth))),
          Promise.all(previousMonthsForTeam.map((yearMonth) => getTeamMonthlySnapshot(team.teamId, yearMonth))),
        ]);

        return sumSnapshots(team.teamId, team.teamName, targetFiscalYear, resolvedFiscalStartMonth, snapshots, previousSnapshots);
      }),
    );

    return {
      fiscalYear: targetFiscalYear,
      summaries: yearSummaries,
      totals: sumTotals(yearSummaries),
    };
  }

  const currentYearSummary = await buildRangeSummary(resolvedFiscalYear, months, previousMonths);
  const previousYearSummary = await buildRangeSummary(resolvedFiscalYear - 1, previousMonths, previousPreviousMonths);
  const summaries = currentYearSummary.summaries;
  const totals = currentYearSummary.totals;
  const comparisonResults = [currentYearSummary, previousYearSummary].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const comparisonRows = comparisonResults.map((result) => toComparisonRow(result.fiscalYear, resolvedFiscalStartMonth, result.totals));
  const teamComparisonRows = resolvedSelectedTeamId
    ? comparisonResults
        .map((result) => result.summaries.find((row) => row.teamId === resolvedSelectedTeamId))
        .filter((row): row is TeamAnnualSnapshot => Boolean(row))
        .map((row) => toTeamComparisonRow(row.fiscalYear, resolvedFiscalStartMonth, row))
    : [];

  return {
    fiscalYear: resolvedFiscalYear,
    fiscalYearLabel: buildFiscalYearLabel(resolvedFiscalYear, resolvedFiscalStartMonth),
    fiscalStartMonth: resolvedFiscalStartMonth,
    fiscalStartMonthLabel: buildFiscalStartMonthLabel(resolvedFiscalStartMonth),
    options: (fiscalYears.length > 0 ? fiscalYears : [resolvedFiscalYear]).map((year) => ({
      fiscalYear: year,
      label: buildFiscalYearLabel(year, resolvedFiscalStartMonth),
    })),
    fiscalStartMonthOptions: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      label: buildFiscalStartMonthLabel(index + 1),
    })),
    summaries: summaries.sort((a, b) => b.finalGrossProfit - a.finalGrossProfit),
    totals,
    coveredMonths: months,
    previousCoveredMonths: previousMonths,
    comparisonRows,
    selectedTeamId: resolvedSelectedTeamId,
    selectedTeamName: resolvedSelectedTeamName,
    teamComparisonRows,
    rangeStartYearMonth: normalizedRange.start,
    rangeEndYearMonth: normalizedRange.end,
    rangeOptions: fiscalMonths,
  };
}

export async function saveAnnualTargetRate(input: SaveAnnualTargetRateInput): Promise<{ persisted: boolean }> {
  const months = buildFiscalYearMonths(input.fiscalYear, input.fiscalStartMonth);
  const teams = await getVisibleTeamOptions();

  if (teams.length === 0) {
    return { persisted: false };
  }

  const results = await Promise.all(
    months.map((yearMonth) =>
      saveMonthlyTargetRates({
        yearMonth,
        targets: teams.map((team) => ({
          teamId: team.teamId,
          targetGrossProfitRate: input.targetGrossProfitRate,
        })),
      }),
    ),
  );

  return {
    persisted: results.every((result: { persisted: boolean }) => result.persisted),
  };
}
