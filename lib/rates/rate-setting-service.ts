/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions/check";

export type TeamOption = {
  teamId: string;
  teamName: string;
};

export type RateHistoryRow = {
  id: string;
  effectiveFrom: string;
  unitPrice: number;
  defaultWorkRate: number;
  outsourceAmount?: number;
  remarks: string;
};

export type EmployeeRateRow = {
  userId: string;
  employeeCode: string;
  employeeName: string;
  teamId: string;
  teamName: string;
  effectiveFrom: string;
  unitPrice: number;
  defaultWorkRate: number;
  remarks: string;
  history: RateHistoryRow[];
};

export type PartnerRateRow = {
  partnerId: string;
  partnerName: string;
  jurisdictionTeamId: string;
  jurisdictionTeamName: string;
  effectiveFrom: string;
  salesUnitPrice: number;
  defaultWorkRate: number;
  outsourceAmount: number;
  affiliation: string;
  note: string;
  history: RateHistoryRow[];
};

export type RateSettingsBundle = {
  employeeRates: EmployeeRateRow[];
  partnerRates: PartnerRateRow[];
  teamOptions: TeamOption[];
  source: "database" | "fallback";
};

export type SaveRateSettingsInput = {
  employeeRates: EmployeeRateRow[];
  partnerRates: PartnerRateRow[];
  deletedPartnerIds: string[];
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function formatDate(value: Date) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(value);
}

export function canManageRateSettings(user: SessionUser) {
  return user.role === "admin" || user.role === "president" || user.role === "leader";
}

function canManageAllRateSettings(user: SessionUser) {
  return user.role === "admin" || user.role === "president";
}

const fallbackBundle: RateSettingsBundle = {
  employeeRates: [
    {
      userId: "demo-leader",
      employeeCode: "E1001",
      employeeName: "主任 次郎",
      teamId: "team-platform",
      teamName: "プラットフォームチーム",
      effectiveFrom: "2026-04-01",
      unitPrice: 950000,
      defaultWorkRate: 100,
      remarks: "基幹案件標準単価",
      history: [
        {
          id: "demo-leader-rate-1",
          effectiveFrom: "2026-04-01",
          unitPrice: 950000,
          defaultWorkRate: 100,
          remarks: "基幹案件標準単価",
        },
      ],
    },
    {
      userId: "demo-member1",
      employeeCode: "E1002",
      employeeName: "開発 一郎",
      teamId: "team-platform",
      teamName: "プラットフォームチーム",
      effectiveFrom: "2026-04-01",
      unitPrice: 800000,
      defaultWorkRate: 100,
      remarks: "開発支援標準単価",
      history: [
        {
          id: "demo-member1-rate-1",
          effectiveFrom: "2026-04-01",
          unitPrice: 800000,
          defaultWorkRate: 100,
          remarks: "開発支援標準単価",
        },
      ],
    },
  ],
  partnerRates: [
    {
      partnerId: "partner-001",
      partnerName: "協力会社A",
      jurisdictionTeamId: "team-platform",
      jurisdictionTeamName: "プラットフォームチーム",
      effectiveFrom: "2026-04-01",
      salesUnitPrice: 700000,
      defaultWorkRate: 100,
      outsourceAmount: 620000,
      affiliation: "プラットフォームチーム",
      note: "標準外注費",
      history: [
        {
          id: "demo-partner-rate-1",
          effectiveFrom: "2026-04-01",
          unitPrice: 700000,
          defaultWorkRate: 100,
          outsourceAmount: 620000,
          remarks: "標準外注費",
        },
      ],
    },
  ],
  teamOptions: [
    { teamId: "team-platform", teamName: "プラットフォームチーム" },
    { teamId: "team-application", teamName: "アプリケーションチーム" },
  ],
  source: "fallback",
};

function filterBundle(bundle: RateSettingsBundle, user: SessionUser): RateSettingsBundle {
  if (canManageAllRateSettings(user)) {
    return bundle;
  }

  return {
    ...bundle,
    employeeRates: bundle.employeeRates.filter((row) => user.teamIds.includes(row.teamId)),
    partnerRates: bundle.partnerRates.filter((row) => row.jurisdictionTeamId && user.teamIds.includes(row.jurisdictionTeamId)),
    teamOptions: bundle.teamOptions.filter((row) => user.teamIds.includes(row.teamId)),
  };
}

function latestByDate(rows: any[]) {
  return [...rows].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] as any;
}

export async function getRateSettingsBundle(user: SessionUser): Promise<RateSettingsBundle> {
  if (!hasDatabaseUrl()) {
    return filterBundle(fallbackBundle, user);
  }

  try {
    const [users, partners, teams]: [any[], any[], any[]] = await Promise.all([
      prisma.user.findMany({
        where: { status: UserStatus.ACTIVE },
        orderBy: { employeeCode: "asc" },
        select: {
          id: true,
          employeeCode: true,
          name: true,
          teamMemberships: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: { teamId: true, team: { select: { name: true } } },
          },
          employeeSalesRateSettings: {
            orderBy: { effectiveFrom: "desc" },
            select: {
              id: true,
              effectiveFrom: true,
              unitPrice: true,
              defaultWorkRate: true,
              remarks: true,
            },
          },
        },
      } as any),
      prisma.partner.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          companyName: true,
          salesRateSettings: {
            orderBy: { effectiveFrom: "desc" },
            select: {
              id: true,
              effectiveFrom: true,
              unitPrice: true,
              defaultWorkRate: true,
              remarks: true,
            },
          },
          outsourceRateSettings: {
            orderBy: { effectiveFrom: "desc" },
            select: {
              id: true,
              effectiveFrom: true,
              amount: true,
              remarks: true,
            },
          },
        },
      } as any),
      prisma.team.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    const teamNameMap = new Map(teams.map((team) => [team.id, team.name]));

    const bundle: RateSettingsBundle = {
      employeeRates: users.map((user: any) => {
        const latest = latestByDate(user.employeeSalesRateSettings as any);
        return {
          userId: user.id,
          employeeCode: user.employeeCode,
          employeeName: user.name,
          teamId: user.teamMemberships[0]?.teamId ?? "",
          teamName: user.teamMemberships[0]?.team.name ?? "未所属",
          effectiveFrom: latest ? formatDate(latest.effectiveFrom) : "2026-04-01",
          unitPrice: toNumber(latest?.unitPrice),
          defaultWorkRate: toNumber(latest?.defaultWorkRate ?? 100),
          remarks: latest?.remarks ?? "",
          history: user.employeeSalesRateSettings.map((row: any) => ({
            id: row.id,
            effectiveFrom: formatDate(row.effectiveFrom),
            unitPrice: toNumber(row.unitPrice),
            defaultWorkRate: toNumber(row.defaultWorkRate ?? 100),
            remarks: row.remarks ?? "",
          })),
        };
      }),
      partnerRates: partners.map((partner: any) => {
        const latestSales = latestByDate(partner.salesRateSettings as any);
        const latestOutsource = latestByDate(partner.outsourceRateSettings as any);
        const currentEffectiveFrom = latestSales?.effectiveFrom ?? latestOutsource?.effectiveFrom ?? new Date("2026-04-01T00:00:00+09:00");
        const historyDates = Array.from(new Set([
          ...partner.salesRateSettings.map((row: any) => formatDate(row.effectiveFrom)),
          ...partner.outsourceRateSettings.map((row: any) => formatDate(row.effectiveFrom)),
        ])).sort((a, b) => (a < b ? 1 : -1));
        const history = historyDates.map((effectiveFrom) => {
          const salesRow = partner.salesRateSettings.find((row: any) => formatDate(row.effectiveFrom) === effectiveFrom);
          const outsourceRow = partner.outsourceRateSettings.find((row: any) => formatDate(row.effectiveFrom) === effectiveFrom);
          return {
            id: `${salesRow?.id ?? "none"}:${outsourceRow?.id ?? "none"}`,
            effectiveFrom,
            unitPrice: toNumber(salesRow?.unitPrice),
            defaultWorkRate: toNumber(salesRow?.defaultWorkRate ?? 100),
            outsourceAmount: toNumber(outsourceRow?.amount),
            remarks: outsourceRow?.remarks ?? salesRow?.remarks ?? "",
          };
        });

        const jurisdictionTeamId = latestSales?.remarks ?? "";
        return {
          partnerId: partner.id,
          partnerName: partner.name,
          jurisdictionTeamId,
          jurisdictionTeamName: teamNameMap.get(jurisdictionTeamId) ?? "未設定",
          effectiveFrom: formatDate(currentEffectiveFrom),
          salesUnitPrice: toNumber(latestSales?.unitPrice),
          defaultWorkRate: toNumber(latestSales?.defaultWorkRate ?? 100),
          outsourceAmount: toNumber(latestOutsource?.amount),
          affiliation: partner.companyName ?? "",
          note: latestOutsource?.remarks ?? "",
          history,
        };
      }),
      teamOptions: teams.map((team) => ({ teamId: team.id, teamName: team.name })),
      source: "database",
    };

    return filterBundle(bundle, user);
  } catch {
    return filterBundle(fallbackBundle, user);
  }
}

export async function saveRateSettingsBundle(input: SaveRateSettingsInput, user: SessionUser): Promise<RateSettingsBundle> {
  try {
    await prisma.$transaction(async (tx) => {
      const allowedUserIds = canManageAllRateSettings(user)
        ? null
        : new Set(
            (await tx.teamMembership.findMany({
              where: {
                isPrimary: true,
                endDate: null,
                teamId: { in: user.teamIds },
              },
              select: { userId: true },
            })).map((row) => row.userId),
          );

      for (const row of input.employeeRates) {
        if (allowedUserIds && !allowedUserIds.has(row.userId)) continue;
        const effectiveFrom = new Date(`${row.effectiveFrom}T00:00:00+09:00`);
        await (tx.employeeSalesRateSetting as any).upsert({
          where: { userId_effectiveFrom: { userId: row.userId, effectiveFrom } },
          update: {
            unitPrice: row.unitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.remarks || null,
          },
          create: {
            userId: row.userId,
            effectiveFrom,
            unitPrice: row.unitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.remarks || null,
          },
        });
      }

      for (const row of input.partnerRates) {
        if (!canManageAllRateSettings(user) && !user.teamIds.includes(row.jurisdictionTeamId)) continue;
        const normalizedName = row.partnerName.trim();
        if (!normalizedName) continue;

        const persistedPartnerId = row.partnerId.startsWith("new-") ? "" : row.partnerId;
        const partner = persistedPartnerId
          ? await tx.partner.update({
              where: { id: persistedPartnerId },
              data: { name: normalizedName, companyName: row.affiliation.trim() || null, status: "ACTIVE" },
              select: { id: true },
            })
          : await tx.partner.create({
              data: { name: normalizedName, companyName: row.affiliation.trim() || null, status: "ACTIVE" },
              select: { id: true },
            });

        const effectiveFrom = new Date(`${row.effectiveFrom}T00:00:00+09:00`);

        await (tx.partnerSalesRateSetting as any).upsert({
          where: { partnerId_effectiveFrom: { partnerId: partner.id, effectiveFrom } },
          update: {
            unitPrice: row.salesUnitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.jurisdictionTeamId || null,
          },
          create: {
            partnerId: partner.id,
            effectiveFrom,
            unitPrice: row.salesUnitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.jurisdictionTeamId || null,
          },
        });

        await (tx.partnerOutsourceRateSetting as any).upsert({
          where: { partnerId_effectiveFrom: { partnerId: partner.id, effectiveFrom } },
          update: {
            amount: row.outsourceAmount,
            remarks: row.note.trim() || null,
          },
          create: {
            partnerId: partner.id,
            effectiveFrom,
            amount: row.outsourceAmount,
            remarks: row.note.trim() || null,
          },
        });
      }

      for (const partnerId of input.deletedPartnerIds) {
        if (!partnerId || partnerId.startsWith("new-")) continue;
        await tx.partner.update({ where: { id: partnerId }, data: { status: "INACTIVE" } });
      }
    });

    return getRateSettingsBundle(user);
  } catch {
    return {
      employeeRates: input.employeeRates,
      partnerRates: input.partnerRates,
      teamOptions: canManageAllRateSettings(user)
        ? fallbackBundle.teamOptions
        : fallbackBundle.teamOptions.filter((row) => user.teamIds.includes(row.teamId)),
      source: "fallback",
    };
  }
}
