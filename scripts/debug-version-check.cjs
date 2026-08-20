/* 只读排查：核对 Vercel 上保存的版本记录是否真实落库（不改任何数据） */
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

  const recent = await client.query(`
    SELECT "id", "type", "title", "clerkUserId", "projectId",
           "sourceProjectCardId", "sourceMatchAnalysisId", "jdRecordId", "createdAt"
    FROM "VersionRecord"
    ORDER BY "createdAt" DESC
    LIMIT 30
  `);
  console.log("=== 最近 30 条版本记录 ===");
  recent.rows.forEach((r, i) => {
    console.log(
      `[${i + 1}] ${r.type} | ${r.title} | user=${r.clerkUserId} | project=${r.projectId} | card=${r.sourceProjectCardId} | analysis=${r.sourceMatchAnalysisId} | jd=${r.jdRecordId} | at=${r.createdAt}`
    );
  });

  const byUser = await client.query(`
    SELECT "clerkUserId", COUNT(*) AS cnt, MAX("createdAt") AS latest
    FROM "VersionRecord"
    GROUP BY "clerkUserId"
    ORDER BY cnt DESC
  `);
  console.log("\n=== 各用户版本记录数 ===");
  byUser.rows.forEach((r) => console.log(`${r.clerkUserId} | ${r.cnt} 条 | 最新 ${r.latest}`));

  const projects = await client.query(`
    SELECT "id", "clerkUserId", "name", "targetRole", "createdAt"
    FROM "Project"
    ORDER BY "createdAt" DESC
    LIMIT 20
  `);
  console.log("\n=== 最近 20 个求职计划 ===");
  projects.rows.forEach((r) =>
    console.log(`${r.id} | user=${r.clerkUserId} | ${r.name} | ${r.targetRole} | at=${r.createdAt}`)
  );

  await client.end();
})().catch((e) => {
  console.error("查询失败:", e.message);
  process.exit(1);
});
