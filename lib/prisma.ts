import { PrismaClient } from "@prisma/client";

function sanitizeConnectionUrl(value: string | undefined) {
  if (!value) {
    return value;
  }

  return value
    .replace(/([?&])channel_binding=require(&?)/g, (_match, prefix: string, suffix: string) => {
      if (prefix === "?" && suffix) {
        return "?";
      }

      if (!suffix) {
        return "";
      }

      return prefix;
    })
    .replace(/[?&]$/, "");
}

const runtimeDatabaseUrl = sanitizeConnectionUrl(process.env.DATABASE_URL);
const runtimeDirectUrl = sanitizeConnectionUrl(process.env.DIRECT_URL);

// Prisma Client runtime queries are more stable against Neon direct URLs in local dev.
process.env.DATABASE_URL = runtimeDirectUrl || runtimeDatabaseUrl;
process.env.DIRECT_URL = runtimeDirectUrl;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
