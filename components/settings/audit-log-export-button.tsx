"use client";

type AuditLogCsvRow = {
  actedAt: string;
  kind: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  comment: string;
};

type Props = {
  rows: AuditLogCsvRow[];
  filters: {
    kind?: string;
    actor?: string;
    action?: string;
  };
};

function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function AuditLogExportButton({ rows, filters }: Props) {
  function handleExportCsv() {
    const header = ["日時", "種別", "操作者", "アクション", "対象種別", "対象ID", "コメント"];
    const lines = [
      header.join(","),
      ...rows.map((row) => [
        row.actedAt,
        row.kind,
        row.actorName,
        row.action,
        row.targetType,
        row.targetId,
        row.comment || "-",
      ].map(escapeCsv).join(",")),
    ];

    const filterSuffix = [filters.kind, filters.actor, filters.action].filter(Boolean).join("-") || "all";
    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${filterSuffix}.csv`;
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
      className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:border-slate-200 disabled:text-slate-300"
    >
      CSV出力
    </button>
  );
}
