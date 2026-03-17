import path from "node:path";

export type PrismaFindMany = (args?: unknown) => Promise<unknown[]>;

export type PrismaClientLike = {
  user: { findMany: PrismaFindMany };
  teamTarget: { findMany: PrismaFindMany };
  monthlyAssignment: { findMany: PrismaFindMany };
  monthlyCost: { findMany: PrismaFindMany };
  teamIndirectCost: { findMany: PrismaFindMany };
  fixedCostAllocation: { findMany: PrismaFindMany };
  teamMembership: { findMany: PrismaFindMany };
};

const globalForPrisma = globalThis as typeof globalThis & {
  __prisma__: PrismaClientLike | null | undefined;
};

function createPrismaClient(): PrismaClientLike | null {
  try {
    const prismaModule = eval("require")(path.join(process.cwd(), "generated/prisma")) as {
      PrismaClient: new () => PrismaClientLike;
    };

    return new prismaModule.PrismaClient();
  } catch {
    return null;
  }
}

export const prisma = globalForPrisma.__prisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma__ = prisma;
}