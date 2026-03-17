import { PrismaClient } from "@/generated/prisma";

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
