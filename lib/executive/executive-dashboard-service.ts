import { getAnnualEvaluationSummaryBundle } from "@/lib/evaluations/annual-summary-service";
import { getEvaluationPeriodOptions } from "@/lib/evaluations/period-service";
import { getOrganizationBundle } from "@/lib/organization/organization-service";
import { getAnnualDashboardBundle } from "@/lib/pl/annual-service";
import { calculateGrossProfit } from "@/lib/pl/calculations";
import { getTeamMonthlyDetails } from "@/lib/pl/detail-service";
import { getCompanyTargetGrossProfitRate, getVisibleTeamMonthlySnapshots, getVisibleYearMonthOptions } from "@/lib/pl/service";
import { getUnassignedPersonalProfitRows } from "@/lib/pl/unassigned-profit-service";
import { getSalarySimulationBundle } from "@/lib/salary-simulations/salary-simulation-service";

export type ExecutiveDashboardBundle = {
  rangeStartYearMonth: string;
  rangeEndYearMonth: string;
  fiscalYear: number;
  fiscalStartMonth: number;
  evaluationPeriodId: string;
  departmentId: string;
  companyTargetGrossProfitRate: number;
  monthlyTotals: {
    salesTotal: number;
    finalGrossProfit: number;
    grossProfitRate: number;
    varianceRate: number;
  };
  annualTotals: {
    salesTotal: number;
    finalGrossProfit: number;
    grossProfitRate: number;
    varianceRate: number;
  };
  evaluationTotals: {
    finalizedCount: number;
    totalCount: number;
    averageFinalScore: number;
  };
  salaryTotals: {
    totalRaiseAmount: number;
    approvedRaiseAmount: number;
    appliedRaiseAmount: number;
    draftCount: number;
    approvedCount: number;
    appliedCount: number;
  };
  monthlyTeamRows: Array<{
    teamId: string;
    teamName: string;
    salesTotal: number;
    finalGrossProfit: number;
    actualGrossProfitRate: number;
    targetGrossProfitRate: number;
    varianceRate: number;
  }>;
  unassignedEmployeeRows: Array<{
    userId: string;
    employeeCode: string;
    userName: string;
    departmentId: string;
    departmentName: string;
    salesTotal: number;
    directLaborCost: number;
    fixedCostAllocation: number;
    finalGrossProfit: number;
    actualGrossProfitRate: number;
    targetGrossProfitRate: number;
    varianceRate: number;
  }>;
  annualComparisonRows: Array<{
    fiscalYear: number;
    fiscalYearLabel: string;
    salesTotal: number;
    finalGrossProfit: number;
    grossProfitRate: number;
    varianceRate: number;
  }>;
  evaluationPeriodRows: Array<{
    evaluationPeriodId: string;
    periodName: string;
    finalizedCount: number;
    totalCount: number;
    averageFinalScore: number;
    proposedRaiseAmountTotal: number;
  }>;
  yearMonthOptions: string[];
  evaluationPeriodOptions: Array<{ id: string; name: string }>;
  departmentOptions: Array<{ id: string; name: string }>;
  fiscalYearOptions: Array<{ fiscalYear: number; label: string }>;
  fiscalStartMonthOptions: Array<{ month: number; label: string }>;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function parseFiscalYearFromYearMonth(yearMonth: string, fiscalStartMonth: number) {
  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return month >= fiscalStartMonth ? year : year - 1;
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

async function getVisibleExecutiveMonthlyRows(yearMonth: string) {
  const snapshots = await getVisibleTeamMonthlySnapshots(yearMonth);
  const details = await Promise.all(snapshots.map((snapshot) => getTeamMonthlyDetails(snapshot.teamId, yearMonth)));
  const detailMap = new Map(details.map((detail) => [detail.teamId, detail]));

  return snapshots.map((snapshot) => {
    const detail = detailMap.get(snapshot.teamId);
    if (!detail) {
      return snapshot;
    }

    const unassignedEmployeeIdSet = new Set(detail.unassignedEmployeeIds);
    const unassignedPartnerIdSet = new Set(detail.unassignedPartnerIds);
    const visibleAssignments = detail.assignments.filter((row) => {
      if (row.targetType === "EMPLOYEE") {
        return !row.userId || !unassignedEmployeeIdSet.has(row.userId);
      }

      return !row.partnerId || !unassignedPartnerIdSet.has(row.partnerId);
    });
    const recalculated = calculateGrossProfit({
      salesTotal: visibleAssignments.reduce((sum, row) => sum + row.salesAmount, 0),
      directLaborCost: detail.directLaborCostTotal,
      outsourcingCost: detail.outsourcingCosts.reduce((sum, row) => sum + row.amount, 0),
      indirectCost: detail.teamExpenses.reduce((sum, row) => sum + row.amount, 0),
      fixedCostAllocation: detail.fixedCostSummary.allocations.reduce((sum, row) => sum + row.allocatedAmount, 0),
      targetGrossProfitRate: snapshot.targetGrossProfitRate,
    });

    return {
      ...snapshot,
      ...recalculated,
    };
  });
}


export async function getExecutiveDashboardBundle(input?: {
  rangeStartYearMonth?: string;
  rangeEndYearMonth?: string;
  fiscalYear?: number;
  fiscalStartMonth?: number;
  evaluationPeriodId?: string;
  departmentId?: string;
}) : Promise<ExecutiveDashboardBundle> {
  const resolvedFiscalStartMonth = input?.fiscalStartMonth && input.fiscalStartMonth >= 1 && input.fiscalStartMonth <= 12 ? input.fiscalStartMonth : 4;
  const evaluationPeriodOptions = await getEvaluationPeriodOptions();
  const resolvedEvaluationPeriodId = input?.evaluationPeriodId ?? evaluationPeriodOptions[0]?.id ?? "period-2025-h2";
  const organization = await getOrganizationBundle();
  const availableDepartmentIds = new Set(organization.departments.map((department) => department.id));
  const resolvedDepartmentId = input?.departmentId && availableDepartmentIds.has(input.departmentId) ? input.departmentId : "";
  const visibleTeamIds = resolvedDepartmentId
    ? organization.teams.filter((team) => team.departmentId === resolvedDepartmentId).map((team) => team.id)
    : undefined;
  const yearMonthOptions = await getVisibleYearMonthOptions(visibleTeamIds);
  const normalizedRange = normalizeRange(yearMonthOptions.map((option) => option.yearMonth), input?.rangeStartYearMonth, input?.rangeEndYearMonth);
  const resolvedFiscalYear = input?.fiscalYear ?? parseFiscalYearFromYearMonth(normalizedRange.end, resolvedFiscalStartMonth);

  const [monthlyRowsByMonth, annualBundle, evaluationSummary, salaryBundle, companyTargetGrossProfitRate, unassignedRowsByMonth] = await Promise.all([
    Promise.all(normalizedRange.months.map((yearMonth) => getVisibleExecutiveMonthlyRows(yearMonth))),
    getAnnualDashboardBundle(resolvedFiscalYear, resolvedFiscalStartMonth, visibleTeamIds, undefined, normalizedRange.start, normalizedRange.end),
    getAnnualEvaluationSummaryBundle(resolvedFiscalYear, resolvedFiscalStartMonth),
    getSalarySimulationBundle(resolvedEvaluationPeriodId),
    getCompanyTargetGrossProfitRate(normalizedRange.end),
    Promise.all(normalizedRange.months.map((yearMonth) => getUnassignedPersonalProfitRows(yearMonth))),
  ]);

  const departmentTeamIds = new Set(visibleTeamIds ?? organization.teams.map((team) => team.id));
  const monthlyRowMap = new Map<string, { teamId: string; teamName: string; salesTotal: number; finalGrossProfit: number }>();
  for (const rows of monthlyRowsByMonth) {
    for (const row of rows) {
      if (!departmentTeamIds.has(row.teamId)) continue;
      const current = monthlyRowMap.get(row.teamId) ?? { teamId: row.teamId, teamName: row.teamName, salesTotal: 0, finalGrossProfit: 0 };
      current.salesTotal += row.salesTotal;
      current.finalGrossProfit += row.finalGrossProfit;
      monthlyRowMap.set(row.teamId, current);
    }
  }
  const filteredMonthlyRows = Array.from(monthlyRowMap.values()).map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    salesTotal: row.salesTotal,
    finalGrossProfit: row.finalGrossProfit,
    actualGrossProfitRate: row.salesTotal === 0 ? 0 : round2((row.finalGrossProfit / row.salesTotal) * 100),
    targetGrossProfitRate: companyTargetGrossProfitRate,
    varianceRate: row.salesTotal === 0 ? round2(0 - companyTargetGrossProfitRate) : round2((row.finalGrossProfit / row.salesTotal) * 100 - companyTargetGrossProfitRate),
  })).sort((a, b) => a.varianceRate - b.varianceRate);

  const unassignedMap = new Map<string, ExecutiveDashboardBundle["unassignedEmployeeRows"][number]>();
  for (const rows of unassignedRowsByMonth) {
    for (const row of rows) {
      if (resolvedDepartmentId && row.departmentId !== resolvedDepartmentId) continue;
      const current = unassignedMap.get(row.userId) ?? {
        userId: row.userId,
        employeeCode: row.employeeCode,
        userName: row.userName,
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        salesTotal: 0,
        directLaborCost: 0,
        fixedCostAllocation: 0,
        finalGrossProfit: 0,
        actualGrossProfitRate: 0,
        targetGrossProfitRate: companyTargetGrossProfitRate,
        varianceRate: 0,
      };
      current.salesTotal += row.salesTotal;
      current.directLaborCost += row.directLaborCost;
      current.fixedCostAllocation += row.fixedCostAllocation;
      current.finalGrossProfit += row.finalGrossProfit;
      unassignedMap.set(row.userId, current);
    }
  }
  const filteredUnassignedEmployeeRows = Array.from(unassignedMap.values()).map((row) => ({
    ...row,
    actualGrossProfitRate: row.salesTotal === 0 ? 0 : round2((row.finalGrossProfit / row.salesTotal) * 100),
    targetGrossProfitRate: companyTargetGrossProfitRate,
    varianceRate: row.salesTotal === 0 ? round2(0 - companyTargetGrossProfitRate) : round2((row.finalGrossProfit / row.salesTotal) * 100 - companyTargetGrossProfitRate),
  }));

  const monthlySalesTotal = filteredMonthlyRows.reduce((sum, row) => sum + row.salesTotal, 0) + filteredUnassignedEmployeeRows.reduce((sum, row) => sum + row.salesTotal, 0);
  const monthlyFinalGrossProfit = filteredMonthlyRows.reduce((sum, row) => sum + row.finalGrossProfit, 0) + filteredUnassignedEmployeeRows.reduce((sum, row) => sum + row.finalGrossProfit, 0);
  const monthlyGrossProfitRate = monthlySalesTotal === 0 ? 0 : round2((monthlyFinalGrossProfit / monthlySalesTotal) * 100);

  return {
    rangeStartYearMonth: normalizedRange.start,
    rangeEndYearMonth: normalizedRange.end,
    fiscalYear: annualBundle.fiscalYear,
    fiscalStartMonth: annualBundle.fiscalStartMonth,
    evaluationPeriodId: resolvedEvaluationPeriodId,
    departmentId: resolvedDepartmentId,
    companyTargetGrossProfitRate,
    monthlyTotals: {
      salesTotal: monthlySalesTotal,
      finalGrossProfit: monthlyFinalGrossProfit,
      grossProfitRate: monthlyGrossProfitRate,
      varianceRate: round2(monthlyGrossProfitRate - companyTargetGrossProfitRate),
    },
    annualTotals: {
      salesTotal: annualBundle.totals.salesTotal,
      finalGrossProfit: annualBundle.totals.finalGrossProfit,
      grossProfitRate: annualBundle.totals.grossProfitRate,
      varianceRate: annualBundle.totals.varianceRate,
    },
    evaluationTotals: {
      finalizedCount: evaluationSummary.totalEvaluatedCount,
      totalCount: evaluationSummary.totalTargetCount,
      averageFinalScore: evaluationSummary.averageFinalScore,
    },
    salaryTotals: {
      totalRaiseAmount: salaryBundle.rows.reduce((sum, row) => sum + row.proposedRaiseAmount, 0),
      approvedRaiseAmount: salaryBundle.rows.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + row.proposedRaiseAmount, 0),
      appliedRaiseAmount: salaryBundle.rows.filter((row) => row.status === "APPLIED").reduce((sum, row) => sum + row.proposedRaiseAmount, 0),
      draftCount: salaryBundle.rows.filter((row) => row.status === "DRAFT").length,
      approvedCount: salaryBundle.rows.filter((row) => row.status === "APPROVED").length,
      appliedCount: salaryBundle.rows.filter((row) => row.status === "APPLIED").length,
    },
    monthlyTeamRows: filteredMonthlyRows
      .map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        salesTotal: row.salesTotal,
        finalGrossProfit: row.finalGrossProfit,
        actualGrossProfitRate: row.actualGrossProfitRate,
        targetGrossProfitRate: companyTargetGrossProfitRate,
        varianceRate: round2(row.actualGrossProfitRate - companyTargetGrossProfitRate),
      }))
      .sort((a, b) => a.varianceRate - b.varianceRate),
    unassignedEmployeeRows: filteredUnassignedEmployeeRows.map((row) => ({
      userId: row.userId,
      employeeCode: row.employeeCode,
      userName: row.userName,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      salesTotal: row.salesTotal,
      directLaborCost: row.directLaborCost,
      fixedCostAllocation: row.fixedCostAllocation,
      finalGrossProfit: row.finalGrossProfit,
      actualGrossProfitRate: row.actualGrossProfitRate,
      targetGrossProfitRate: row.targetGrossProfitRate,
      varianceRate: row.varianceRate,
    })),
    annualComparisonRows: annualBundle.comparisonRows.map((row) => ({
      fiscalYear: row.fiscalYear,
      fiscalYearLabel: row.fiscalYearLabel,
      salesTotal: row.salesTotal,
      finalGrossProfit: row.finalGrossProfit,
      grossProfitRate: row.grossProfitRate,
      varianceRate: row.varianceRate,
    })),
    evaluationPeriodRows: evaluationSummary.periods.map((period) => ({
      evaluationPeriodId: period.evaluationPeriodId,
      periodName: period.periodName,
      finalizedCount: period.finalizedCount,
      totalCount: period.totalCount,
      averageFinalScore: period.averageFinalScore,
      proposedRaiseAmountTotal: period.proposedRaiseAmountTotal,
    })),
    yearMonthOptions: yearMonthOptions.map((option) => option.yearMonth),
    evaluationPeriodOptions,
    departmentOptions: [{ id: "", name: "全社" }, ...organization.departments.map((department) => ({ id: department.id, name: department.name }))],
    fiscalYearOptions: annualBundle.options,
    fiscalStartMonthOptions: annualBundle.fiscalStartMonthOptions,
  };
}
