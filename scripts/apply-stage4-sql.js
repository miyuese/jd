const fs = require("node:fs");
const path = require("node:path");
const { neon } = require("@neondatabase/serverless");

function sanitizeConnectionUrl(value) {
  if (!value) {
    return value;
  }

  return value.replace(/([?&])channel_binding=require(&?)/g, (match, prefix, suffix) => {
    if (prefix === "?" && suffix) {
      return "?";
    }

    if (!suffix) {
      return "";
    }

    return prefix;
  }).replace(/[?&]$/, "");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in environment.");
  }

  const sqlPath = path.join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260402193000_init_stage4",
    "migration.sql"
  );
  const sqlFile = fs.readFileSync(sqlPath, "utf8");
  const statements = sqlFile
    .split(/;\s*\r?\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  const sql = neon(sanitizeConnectionUrl(process.env.DATABASE_URL));

  await sql.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);

  for (const statement of statements) {
    const normalizedStatement = statement.replace(/;$/, "");

    try {
      await sql.query(normalizedStatement);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        (error.message.includes("already exists") ||
          error.message.includes("duplicate key value") ||
          error.message.includes("relation \"_prisma_migrations\" already exists"))
      ) {
        continue;
      }

      throw new Error(`Failed SQL statement: ${normalizedStatement}\n${error.message || error}`);
    }
  }

  await sql.query(
    `
      INSERT INTO "_prisma_migrations" (
        "id",
        "checksum",
        "finished_at",
        "migration_name",
        "started_at",
        "applied_steps_count"
      )
      VALUES ($1, $2, now(), $3, now(), $4)
      ON CONFLICT ("id") DO NOTHING
    `,
    [
      "20260402193000_init_stage4",
      "manual-stage4-init",
      "20260402193000_init_stage4",
      statements.length
    ]
  );

  console.log("Stage 4 schema applied successfully.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
