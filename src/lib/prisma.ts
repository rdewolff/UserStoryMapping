import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prisma__: PrismaClient | undefined;
}

function sqliteFilePathFromDatabaseUrl(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) {
    return databaseUrl.slice("file:".length);
  }

  return databaseUrl;
}

const rawDatabaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const sqlitePath = sqliteFilePathFromDatabaseUrl(rawDatabaseUrl) || "./dev.db";
const adapter = new PrismaBetterSqlite3({
  url: sqlitePath,
});

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
