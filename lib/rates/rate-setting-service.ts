import { UserStatus } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";

export type EmployeeRateRow = {
  userId: string;
  employeeCode: string;
  employeeName: string;
  teamName: string;
  unitPrice: number;
  defaultWorkRate: number;
  remarks: string;
};

export type PartnerRateRow = {
  partnerId: string;
  partnerName: string;
  companyName: string | null;
  salesUnitPrice: number;
  defaultWorkRate: number;
  outsourceAmount: number;
  salesRemarks: string;
  outsourceRemarks: string;
};

export type RateSettingsBundle = {
  employeeRates: EmployeeRateRow[];
  partnerRates: PartnerRateRow[];
  source: "database" | "fallback";
};

export type SaveRateSettingsInput = {
  employeeRates: EmployeeRateRow[];
  partnerRates: PartnerRateRow[];
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

const fallbackBundle: RateSettingsBundle = {
  employeeRates: [
    {
      userId: "demo-leader",
      employeeCode: "E1001",
      employeeName: "主任 次郎",
      teamName: "プラットフォームチーム",
      unitPrice: 950000,
      defaultWorkRate: 100,
      remarks: "基幹案件標準単価",
    },
    {
      userId: "demo-member1",
      employeeCode: "E1002",
      employeeName: "開発 一郎",
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
      companyName: "協力会社A株式会社",
      salesUnitPrice: 700000,
      defaultWorkRate: 100,
      outsourceAmount: 620000,
      salesRemarks: "標準売上単価",
      outsourceRemarks: "標準外注費",
    },
  ],
  source: "fallback",
};

export async function getRateSettingsBundle(): Promise<RateSettingsBundle> {
  try {
    const [users, partners] = await Promise.all([
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
            select: { team: { select: { name: true } } },
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
        where: { status: UserStatus.ACTIVE },
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
    ]);

    return {
      employeeRates: users.map((user) => ({
        userId: user.id,
        employeeCode: user.employeeCode,
        employeeName: user.name,
        teamName: user.teamMemberships[0]?.team.name ?? "未所属",
        unitPrice: toNumber(user.employeeSalesRateSetting?.unitPrice),
        defaultWorkRate: toNumber(user.employeeSalesRateSetting?.defaultWorkRate ?? 100),
        remarks: user.employeeSalesRateSetting?.remarks ?? "",
      })),
      partnerRates: partners.map((partner) => ({
        partnerId: partner.id,
        partnerName: partner.name,
        companyName: partner.companyName,
        salesUnitPrice: toNumber(partner.salesRateSetting?.unitPrice),
        defaultWorkRate: toNumber(partner.salesRateSetting?.defaultWorkRate ?? 100),
        outsourceAmount: toNumber(partner.outsourceRateSetting?.amount),
        salesRemarks: partner.salesRateSetting?.remarks ?? "",
        outsourceRemarks: partner.outsourceRateSetting?.remarks ?? "",
      })),
      source: "database",
    };
  } catch {
    return fallbackBundle;
  }
}

export async function saveRateSettingsBundle(input: SaveRateSettingsInput): Promise<RateSettingsBundle> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of input.employeeRates) {
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
        await tx.partnerSalesRateSetting.upsert({
          where: { partnerId: row.partnerId },
          update: {
            unitPrice: row.salesUnitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.salesRemarks || null,
          },
          create: {
            partnerId: row.partnerId,
            unitPrice: row.salesUnitPrice,
            defaultWorkRate: row.defaultWorkRate,
            remarks: row.salesRemarks || null,
          },
        });

        await tx.partnerOutsourceRateSetting.upsert({
          where: { partnerId: row.partnerId },
          update: {
            amount: row.outsourceAmount,
            remarks: row.outsourceRemarks || null,
          },
          create: {
            partnerId: row.partnerId,
            amount: row.outsourceAmount,
            remarks: row.outsourceRemarks || null,
          },
        });
      }
    });

    return getRateSettingsBundle();
  } catch {
    return {
      employeeRates: input.employeeRates,
      partnerRates: input.partnerRates,
      source: "fallback",
    };
  }
}
