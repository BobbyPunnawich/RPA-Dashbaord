import { PrismaClient } from "@prisma/client";

const _dbUrl = process.env.DATABASE_URL;
if (!_dbUrl) {
  console.error(
    "[prisma.ts] DATABASE_URL is undefined — check your .env / .env.local file"
  );
} else {
  const masked = _dbUrl.replace(/:([^@]+)@/, ":***@");
  console.log("[prisma.ts] DATABASE_URL =", masked);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
