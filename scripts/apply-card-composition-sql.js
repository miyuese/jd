const fs = require("node:fs");
const path = require("node:path");
const { neon } = require("@neondatabase/serverless");

function sanitizeConnectionUrl(value) {
  if (!value) {
    return value;
  }
  return value
    .replace(/([?&])channel_binding=require(&?)/g, (match, prefix, suffix) => {
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

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in environment.");
  }

  const migrationDir = "20260814100000_card_composition";
  const sqlPath = path.join(process.cwd(), "prisma", "migrations", migrationDir, "migration.sql");
  const sqlFile = fs.readFileSync(sqlPath, "utf8");
  const statements = sqlFile
    .split(/;\s*\r?\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  const sql = neon(sanitizeConnectionUrl(process.env.DATABASE_URL));
  let applied = 0;

  for (const statement of statements) {
    const normalizedStatement = statement.replace(/;$/, "");

    try {
      await sql.query(normalizedStatement);
      applied += 1;
      console.log(`OK: ${normalizedStatement.slice(0, 80)}...`);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        (error.message.includes("already exists") || error.message.includes("duplicate column") || error.message.includes("duplicate key value"))
      ) {
        console.log(`SKIP (already applied): ${normalizedStatement.slice(0, 80)}...`);
        continue;
      }
      throw new Error(`Failed SQL statement: ${normalizedStatement}\n${error.message || error}`);
    }
  }

  console.log(`Migration ${migrationDir} applied successfully (${applied} statements).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
