import { defineConfig } from "prisma/config";

const fallbackDatabaseUrl = "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
});