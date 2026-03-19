import { getAnnualEvaluationSummaryBundle } from "@/lib/evaluations/annual-summary-service";
import { getEvaluationPeriodOptions } from "@/lib/evaluations/period-service";
import { getOrganizationBundle } from "@/lib/organization/organization-service";
import { getAnnualDashboardBundle } from "@/lib/pl/annual-service";
import { getCompanyTargetGrossProfitRate, getVisibleTeamMonthlySnapshots, getVisibleYearMonthOptions } from "@/lib/pl/service";
import { getUnassignedPersonalProfitRows } from "@/lib/pl/unassigned-profit-service";
import { getSalarySimulationBundle } from "@/lib/salary-simulations/salary-simulation-service";

export type ExecutiveDashboardBundle = {
  yearMonth: string;
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

export async function getExecutiveDashboardBundle(input?: {
  yearMonth?: string;
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
  const resolvedYearMonth = input?.yearMonth ?? yearMonthOptions[0]?.yearMonth ?? "2026-03";
  const resolvedFiscalYear = input?.fiscalYear ?? parseFiscalYearFromYearMonth(resolvedYearMonth, resolvedFiscalStartMonth);

  const [monthlyRows, annualBundle, evaluationSummary, salaryBundle, companyTargetGrossProfitRate, unassignedEmployeeRows] = await Promise.all([
    getVisibleTeamMonthlySnapshots(resolvedYearMonth),
    getAnnualDashboardBundle(resolvedFiscalYear, resolvedFiscalStartMonth, visibleTeamIds),
    getAnnualEvaluationSummaryBundle(resolvedFiscalYear, resolvedFiscalStartMonth),
    getSalarySimulationBundle(resolvedEvaluationPeriodId),
    getCompanyTargetGrossProfitRate(resolvedYearMonth),
    getUnassignedPersonalProfitRows(resolvedYearMonth),
  ]);

  const departmentTeamIds = new Set(visibleTeamIds ?? organization.teams.map((team) => team.id));
  const filteredMonthlyRows = monthlyRows.filter((row) => departmentTeamIds.has(row.teamId));
  const filteredUnassignedEmployeeRows = resolvedDepartmentId
    ? unassignedEmployeeRows.filter((row) => row.departmentId === resolvedDepartmentId)
    : unassignedEmployeeRows;

  const monthlySalesTotal = filteredMonthlyRows.reduce((sum, row) => sum + row.salesTotal, 0) + filteredUnassignedEmployeeRows.reduce((sum, row) => sum + row.salesTotal, 0);
  const monthlyFinalGrossProfit = filteredMonthlyRows.reduce((sum, row) => sum + row.finalGrossProfit, 0) + filteredUnassignedEmployeeRows.reduce((sum, row) => sum + row.finalGrossProfit, 0);
  const monthlyGrossProfitRate = monthlySalesTotal === 0 ? 0 : round2((monthlyFinalGrossProfit / monthlySalesTotal) * 100);

  return {
    yearMonth: resolvedYearMonth,
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
