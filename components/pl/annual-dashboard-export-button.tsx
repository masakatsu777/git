"use client";

type AnnualCsvRow = {
  teamName: string;
  salesTotal: number;
  salesYoYRate: number;
  finalGrossProfit: number;
  grossProfitYoYRate: number;
  grossProfitRate: number;
  targetGrossProfitRate: number;
  varianceRate: number;
  coveredMonths: string[];
};

type Props = {
  fiscalYearLabel: string;
  fiscalStartMonthLabel: string;
  rows: AnnualCsvRow[];
};

function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function AnnualDashboardExportButton({ fiscalYearLabel, fiscalStartMonthLabel, rows }: Props) {
  function handleExportCsv() {
    const header = [
      "年度",
      "年度開始月",
      "チーム",
      "年度売上",
      "売上前年同期比(%)",
      "年度最終粗利",
      "粗利前年同期比(%)",
      "年度粗利率(%)",
      "目標粗利率(%)",
      "差異(pt)",
      "対象月",
    ];
    const lines = [
      header.join(","),
      ...rows.map((row) => [
        fiscalYearLabel,
        fiscalStartMonthLabel,
        row.teamName,
        row.salesTotal,
        row.salesYoYRate,
        row.finalGrossProfit,
        row.grossProfitYoYRate,
        row.grossProfitRate,
        row.targetGrossProfitRate,
        row.varianceRate,
        row.coveredMonths.join(" / "),
      ].map(escapeCsv).join(",")),
    ];

    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `annual-dashboard-${fiscalYearLabel}-${fiscalStartMonthLabel}.csv`;
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
      className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white disabled:border-white/10 disabled:text-white/40"
    >
      CSV出力
    </button>
  );
}
