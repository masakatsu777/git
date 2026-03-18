import { PrismaClient } from "@/generated/prisma";

const fallbackDatabaseUrl = "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";

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
    datasourceUrl: process.env.DATABASE_URL?.trim() || fallbackDatabaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
