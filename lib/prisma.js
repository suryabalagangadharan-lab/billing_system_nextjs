import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis;
const connectionString = process.env.DATABASE_URL;
const isNeonConnection = Boolean(connectionString && connectionString.includes(".neon.tech"));

function createPrismaClient() {
  const options = {
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  };

  if (isNeonConnection) {
    options.adapter = new PrismaNeon({ connectionString });
  }

  return new PrismaClient(options);
}

export const prisma =
  globalForPrisma.prisma ||
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
