import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  console.error(
    "[prisma.ts] DATABASE_URL is undefined — check your .env / .env.local file"
  );
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
