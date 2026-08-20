/* 只读排查：查看各表时间列与关键列的类型（不改数据） */
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

  const tables = ["VersionRecord", "ProjectCard", "MatchAnalysis", "JdRecord", "Project", "ProjectMaterial"];
  for (const table of tables) {
    const rows = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    console.log(`=== ${table} ===`);
    rows.rows
      .filter((r) => ["createdat", "updatedat", "iscurrentprojectcard", "projectcardid"].includes(r.column_name.toLowerCase()))
      .forEach((r) => console.log(`  ${r.column_name}: ${r.data_type} | null=${r.is_nullable} | default=${r.column_default ?? "-"}`));
  }

  await client.end();
})().catch((e) => {
  console.error("查询失败:", e.message);
  process.exit(1);
});
