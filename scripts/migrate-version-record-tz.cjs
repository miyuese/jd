/* 数据库迁移：VersionRecord.createdAt 从 timestamp(无时区) 改为 timestamptz，现有 UTC 值按 UTC 解释 */
const { Client } = require("pg");

const raw = process.env.DATABASE_URL || "";
const url = raw
  .replace(/([?&])channel_binding=require(&?)/g, (_m, prefix, suffix) => {
    if (prefix === "?" && suffix) return "?";
    if (!suffix) return "";
    return prefix;
  })
  .replace(/[?&]$/, "");

(async () => {
  const client = new Client({ connectionString: url });
  await client.connect();

  const before = await client.query(`SELECT COUNT(*) AS cnt FROM "VersionRecord"`);
  console.log("迁移前 VersionRecord 行数:", before.rows[0].cnt);

  await client.query(`
    ALTER TABLE "VersionRecord"
    ALTER COLUMN "createdAt" TYPE timestamptz
    USING "createdAt" AT TIME ZONE 'UTC'
  `);
  console.log("迁移完成：createdAt -> timestamptz（按 UTC 解释现有值）");

  const check = await client.query(`
    SELECT "id", "title", "createdAt" FROM "VersionRecord" ORDER BY "createdAt" DESC LIMIT 3
  `);
  console.log("迁移后最新 3 条：");
  check.rows.forEach((r) => console.log(`  ${r.title} | ${r.createdAt}`));

  await client.end();
})().catch((e) => {
  console.error("迁移失败:", e.message);
  process.exit(1);
});
