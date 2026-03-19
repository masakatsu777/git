import { UserStatus } from "@/generated/prisma";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions/check";

export type TeamOption = {
  teamId: string;
  teamName: string;
};

export type EmployeeRateRow = {
  userId: string;
  employeeCode: string;
  employeeName: string;
  teamId: string;
  teamName: string;
  unitPrice: number;
  defaultWorkRate: number;
  remarks: string;
};

export type PartnerRateRow = {
  partnerId: string;
  partnerName: string;
  jurisdictionTeamId: string;
  jurisdictionTeamName: string;
  salesUnitPrice: number;
  defaultWorkRate: number;
  outsourceAmount: number;
  affiliation: string;
  note: string;
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
      unitPrice: 950000,
      defaultWorkRate: 100,
      remarks: "基幹案件標準単価",
    },
    {
      userId: "demo-member1",
      employeeCode: "E1002",
      employeeName: "開発 一郎",
      teamId: "team-platform",
      teamName: "プラットフォームチーム",
      unitPrice: 800000,
      defaultWorkRate: 100,
      remarks: "開発支援標準単価",
    },
  ],
  partnerRates: [
    {
      partnerId: "partner-001",
      partnerName: "協力会社A",
      jurisdictionTeamId: "team-platform",
      jurisdictionTeamName: "プラットフォームチーム",
      salesUnitPrice: 700000,
      defaultWorkRate: 100,
      outsourceAmount: 620000,
      affiliation: "プラットフォームチーム",
      note: "標準外注費",
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

export async function getRateSettingsBundle(user: SessionUser): Promise<RateSettingsBundle> {
  if (!hasDatabaseUrl()) {
    return filterBundle(fallbackBundle, user);
  }

  try {
    const [users, partners, teams] = await Promise.all([
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
          employeeSalesRateSetting: {
            select: {
              unitPrice: true,
              defaultWorkRate: true,
              remarks: true,
            },
          },
        },
      }),
      prisma.partner.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          companyName: true,
          salesRateSetting: {
            select: {
              unitPrice: true,
              defaultWorkRate: true,
              remarks: true,
            },
          },
          outsourceRateSetting: {
            select: {
              amount: true,
              remarks: true,
            },
          },
        },
      }),
      prisma.team.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    const teamNameMap = new Map(teams.map((team) => [team.id, team.name]));

    const bundle: RateSettingsBundle = {
      employeeRates: users.map((user) => ({
        userId: user.id,
        employeeCode: user.employeeCode,
        employeeName: user.name,
        teamId: user.teamMemberships[0]?.teamId ?? "",
        teamName: user.teamMemberships[0]?.team.name ?? "未所属",
        unitPrice: toNumber(user.employeeSalesRateSetting?.unitPrice),
        defaultWorkRate: toNumber(user.employeeSalesRateSetting?.defaultWorkRate ?? 100),
        remarks: user.employeeSalesRateSetting?.remarks ?? "",
      })),
      partnerRates: partners.map((partner) => {
        const jurisdictionTeamId = partner.salesRateSetting?.remarks ?? "";
        return {
          partnerId: partner.id,
          partnerName: partner.name,
          jurisdictionTeamId,
          jurisdictionTeamName: teamNameMap.get(jurisdictionTeamId) ?? "未設定",
          salesUnitPrice: toNumber(partner.salesRateSetting?.unitPrice),
          defaultWorkRate: toNumber(partner.salesRateSetting?.defaultWorkRate ?? 100),
          outsourceAmount: toNumber(partner.outsourceRateSetting?.amount),
          affiliation: partner.companyName ?? "",
          note: partner.outsourceRateSetting?.remarks ?? "",
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

      const allowedPartnerIds = canManageAllRateSettings(user)
        ? null
        : new Set(
            (await tx.partnerSalesRateSetting.findMany({
              where: { remarks: { in: user.teamIds } },
              select: { partnerId: true },
            })).map((row) => row.partnerId),
          );

      for (const row of input.employeeRates) {
        if (allowedUserIds && !allowedUserIds.has(row.userId)) {
          continue;
        }

        await tx.employeeSalesRateSetting.upsert({
          where: { userId: row.userId },
          update: {
            unitPrice: row.unitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.remarks || null,
          },
          create: {
            userId: row.userId,
            unitPrice: row.unitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.remarks || null,
          },
        });
      }

      for (const row of input.partnerRates) {
        if (!canManageAllRateSettings(user) && !user.teamIds.includes(row.jurisdictionTeamId)) {
          continue;
        }

        const normalizedName = row.partnerName.trim();
        if (!normalizedName) {
          continue;
        }

        const persistedPartnerId = row.partnerId.startsWith("new-") ? "" : row.partnerId;
        if (allowedPartnerIds && persistedPartnerId && !allowedPartnerIds.has(persistedPartnerId)) {
          continue;
        }

        const partner = persistedPartnerId
          ? await tx.partner.update({
              where: { id: persistedPartnerId },
              data: {
                name: normalizedName,
                companyName: row.affiliation.trim() || null,
                status: "ACTIVE",
              },
              select: { id: true },
            })
          : await tx.partner.create({
              data: {
                name: normalizedName,
                companyName: row.affiliation.trim() || null,
                status: "ACTIVE",
              },
              select: { id: true },
            });

        await tx.partnerSalesRateSetting.upsert({
          where: { partnerId: partner.id },
          update: {
            unitPrice: row.salesUnitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.jurisdictionTeamId || null,
          },
          create: {
            partnerId: partner.id,
            unitPrice: row.salesUnitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.jurisdictionTeamId || null,
          },
        });

        await tx.partnerOutsourceRateSetting.upsert({
          where: { partnerId: partner.id },
          update: {
            amount: row.outsourceAmount,
            remarks: row.note.trim() || null,
          },
          create: {
            partnerId: partner.id,
            amount: row.outsourceAmount,
            remarks: row.note.trim() || null,
          },
        });
      }

      for (const partnerId of input.deletedPartnerIds) {
        if (!partnerId || partnerId.startsWith("new-")) {
          continue;
        }

        if (allowedPartnerIds && !allowedPartnerIds.has(partnerId)) {
          continue;
        }

        await tx.partner.update({
          where: { id: partnerId },
          data: { status: "INACTIVE" },
        });
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
