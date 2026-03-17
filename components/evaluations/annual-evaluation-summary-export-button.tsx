"use client";

type PeriodRow = {
  periodName: string;
  startDate: string;
  endDate: string;
  finalizedCount: number;
  totalCount: number;
  averageFinalScore: number;
  ratingCounts: Record<string, number>;
  salarySimulationStatusCounts: Record<string, number>;
  proposedRaiseAmountTotal: number;
};

type Props = {
  fiscalYearLabel: string;
  fiscalStartMonthLabel: string;
  rows: PeriodRow[];
};

function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function AnnualEvaluationSummaryExportButton({ fiscalYearLabel, fiscalStartMonthLabel, rows }: Props) {
  function handleExportCsv() {
    const header = ["年度", "年度開始月", "評価期間", "開始日", "終了日", "確定数", "対象数", "平均参考評価点", "期待充足ランク分布", "昇給状態", "昇給案合計"];
    const lines = [
      header.join(","),
      ...rows.map((row) => [
        fiscalYearLabel,
        fiscalStartMonthLabel,
        row.periodName,
        row.startDate,
        row.endDate,
        row.finalizedCount,
        row.totalCount,
        row.averageFinalScore,
        Object.entries(row.ratingCounts).map(([rating, count]) => `${rating}:${count}`).join(" / "),
        Object.entries(row.salarySimulationStatusCounts).map(([status, count]) => `${status}:${count}`).join(" / "),
        row.proposedRaiseAmountTotal,
      ].map(escapeCsv).join(",")),
    ];

    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `annual-evaluation-summary-${fiscalYearLabel}-${fiscalStartMonthLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExportCsv}
      disabled={rows.length === 0}
      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:border-slate-200 disabled:text-slate-300"
    >
      評価CSV出力
    </button>
  );
}
