import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Clear cached client after schema changes (prisma generate)
if (process.env.NODE_ENV !== "production" && globalForPrisma.prisma) {
  // Force refresh if new models are missing (e.g., after prisma generate)
  if (!("insightRequest" in globalForPrisma.prisma)) {
    globalForPrisma.prisma = undefined;
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
