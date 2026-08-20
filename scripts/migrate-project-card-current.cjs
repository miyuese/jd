/* 数据库迁移：ProjectCard 增加 isCurrentProjectCard 标记（当前最终版本） */
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

  await client.query(`
    ALTER TABLE "ProjectCard"
    ADD COLUMN IF NOT EXISTS "isCurrentProjectCard" BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("迁移完成：ProjectCard.isCurrentProjectCard 已添加");

  const check = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'ProjectCard' AND column_name = 'isCurrentProjectCard'
  `);
  check.rows.forEach((r) => console.log(`  ${r.column_name}: ${r.data_type} | default=${r.column_default}`));

  await client.end();
})().catch((e) => {
  console.error("迁移失败:", e.message);
  process.exit(1);
});
