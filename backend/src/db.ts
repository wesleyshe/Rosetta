// Lazy singleton Prisma client. Avoids connection-pool churn during
// dev hot-reloads, and keeps the import side-effect-free in tests that
// don't touch the DB.

import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
