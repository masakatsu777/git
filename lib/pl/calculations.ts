export type GrossProfitInput = {
  salesTotal: number;
  directLaborCost: number;
  outsourcingCost: number;
  indirectCost: number;
  fixedCostAllocation: number;
  targetGrossProfitRate: number;
};

export type GrossProfitResult = {
  salesTotal: number;
  directLaborCost: number;
  outsourcingCost: number;
  grossProfit1: number;
  indirectCost: number;
  grossProfit2: number;
  fixedCostAllocation: number;
  finalGrossProfit: number;
  targetGrossProfitRate: number;
  actualGrossProfitRate: number;
  varianceAmount: number;
  varianceRate: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateGrossProfit(input: GrossProfitInput): GrossProfitResult {
  const grossProfit1 = input.salesTotal - (input.directLaborCost + input.outsourcingCost);
  const grossProfit2 = grossProfit1 - input.indirectCost;
  const finalGrossProfit = grossProfit2 - input.fixedCostAllocation;
  const actualGrossProfitRate = input.salesTotal === 0 ? 0 : (finalGrossProfit / input.salesTotal) * 100;
  const targetGrossProfit = input.salesTotal * (input.targetGrossProfitRate / 100);

  return {
    salesTotal: round(input.salesTotal),
    directLaborCost: round(input.directLaborCost),
    outsourcingCost: round(input.outsourcingCost),
    grossProfit1: round(grossProfit1),
    indirectCost: round(input.indirectCost),
    grossProfit2: round(grossProfit2),
    fixedCostAllocation: round(input.fixedCostAllocation),
    finalGrossProfit: round(finalGrossProfit),
    targetGrossProfitRate: round(input.targetGrossProfitRate),
    actualGrossProfitRate: round(actualGrossProfitRate),
    varianceAmount: round(finalGrossProfit - targetGrossProfit),
    varianceRate: round(actualGrossProfitRate - input.targetGrossProfitRate),
  };
}