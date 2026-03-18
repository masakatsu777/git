import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type AuditLogRow = {
  id: string;
  actedAt: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  comment: string;
  kind: "approval" | "audit";
};

export type AuditLogBundle = {
  rows: AuditLogRow[];
  source: "database" | "fallback";
};

const fallbackBundle: AuditLogBundle = {
  rows: [
    {
      id: "audit-demo-1",
      actedAt: "2026-03-13 10:00",
      actorName: "管理 花子",
      action: "FINALIZE_EVALUATION",
      targetType: "employee_evaluation",
      targetId: "demo-member1",
      comment: "最終評価を確定",
      kind: "approval",
    },
  ],
  source: "fallback",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function summarizeSalarySimulationAudit(afterJson: unknown) {
  if (!afterJson || typeof afterJson !== "object") return "";
  const data = afterJson as {
    evaluationPeriodId?: string;
    rowCount?: number;
    adjustedCount?: number;
    missingReasonCount?: number;
    effectiveFrom?: string;
    count?: number;
    rows?: Array<{ employeeName?: string; newSalary?: number; diffAmount?: number; adjustmentReason?: string }>;
  };

  const parts: string[] = [];
  if (typeof data.rowCount === "number") parts.push(`対象${data.rowCount}名`);
  if (typeof data.adjustedCount === "number") parts.push(`差額大${data.adjustedCount}件`);
  if (typeof data.missingReasonCount === "number") parts.push(`理由未入力${data.missingReasonCount}件`);
  if (typeof data.count === "number" && !parts.length) parts.push(`対象${data.count}名`);
  if (data.effectiveFrom) parts.push(`反映日 ${data.effectiveFrom}`);

  const detail = (data.rows ?? [])
    .slice(0, 3)
    .map((row) => {
      const name = row.employeeName ?? "対象";
      const amount = typeof row.newSalary === "number" ? `${row.newSalary.toLocaleString("ja-JP")}円` : "";
      const diff = typeof row.diffAmount === "number" ? `差額${row.diffAmount >= 0 ? "+" : ""}${row.diffAmount.toLocaleString("ja-JP")}円` : "";
      const reason = row.adjustmentReason ? `理由:${row.adjustmentReason}` : "";
      return [name, amount, diff, reason].filter(Boolean).join(" / ");
    })
    .filter(Boolean)
    .join(" | ");

  return [parts.join(" / "), detail].filter(Boolean).join(" | ");
}

function summarizeAuditComment(action: string, resourceType: string, afterJson: unknown) {
  if (resourceType === "salary_revision_simulation") {
    return summarizeSalarySimulationAudit(afterJson);
  }
  return "";
}

export async function getAuditLogBundle(filters?: { kind?: string; actor?: string; action?: string }): Promise<AuditLogBundle> {
  if (!hasDatabaseUrl()) {
    return fallbackBundle;
  }

  try {
    const [approvals, audits] = await Promise.all([
      prisma.approvalLog.findMany({
        orderBy: { actedAt: "desc" },
        take: 100,
        select: {
          id: true,
          actedAt: true,
          action: true,
          targetType: true,
          targetId: true,
          comment: true,
          actor: { select: { name: true } },
        },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          createdAt: true,
          action: true,
          resourceType: true,
          resourceId: true,
          afterJson: true,
          actor: { select: { name: true } },
        },
      }),
    ]);

    const rows: AuditLogRow[] = [
      ...approvals.map((row) => ({
        id: row.id,
        actedAt: formatDate(row.actedAt),
        actorName: row.actor.name,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        comment: row.comment ?? "",
        kind: "approval" as const,
      })),
      ...audits.map((row) => ({
        id: row.id,
        actedAt: formatDate(row.createdAt),
        actorName: row.actor.name,
        action: row.action,
        targetType: row.resourceType,
        targetId: row.resourceId,
        comment: summarizeAuditComment(row.action, row.resourceType, row.afterJson),
        kind: "audit" as const,
      })),
    ]
      .filter((row) => {
        const matchesKind = !filters?.kind || row.kind === filters.kind;
        const matchesActor = !filters?.actor || normalizeText(row.actorName).includes(normalizeText(filters.actor));
        const matchesAction = !filters?.action || normalizeText(row.action).includes(normalizeText(filters.action));
        return matchesKind && matchesActor && matchesAction;
      })
      .sort((a, b) => (a.actedAt < b.actedAt ? 1 : -1));

    return { rows, source: "database" };
  } catch {
    return fallbackBundle;
  }
}
