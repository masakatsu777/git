import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        beforeJson: input.beforeJson as never,
        afterJson: input.afterJson as never,
      },
    });
  } catch {
    // ignore logging failure in app flow
  }
}

export async function writeApprovalLog(input: {
  actedBy: string;
  targetType: string;
  targetId: string;
  action: string;
  comment?: string;
}) {
  try {
    await prisma.approvalLog.create({
      data: {
        actedBy: input.actedBy,
        targetType: input.targetType,
        targetId: input.targetId,
        action: input.action,
        comment: input.comment,
      },
    });
  } catch {
    // ignore logging failure in app flow
  }
}
