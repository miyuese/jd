/* 只读排查：对比 dev-user 与 Vercel 真实用户的匹配分析数据形态（不改数据） */
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

  const rows = await client.query(`
    SELECT "clerkUserId",
           COUNT(*) AS total,
           COUNT("projectCardId") AS with_card,
           COUNT(*) - COUNT("projectCardId") AS without_card,
           MIN("createdAt") AS earliest,
           MAX("createdAt") AS latest
    FROM "MatchAnalysis"
    GROUP BY "clerkUserId"
    ORDER BY total DESC
  `);
  console.log("=== 各用户匹配分析（MatchAnalysis）的卡片关联情况 ===");
  rows.rows.forEach((r) =>
    console.log(
      `${r.clerkUserId} | 共 ${r.total} 条 | 有关联卡片 ${r.with_card} 条 | 无卡片 ${r.without_card} 条 | ${r.earliest} ~ ${r.latest}`
    )
  );

  const detail = await client.query(`
    SELECT "clerkUserId", "id", "projectId", "projectCardId", "jdRecordId", "createdAt"
    FROM "MatchAnalysis"
    ORDER BY "createdAt" DESC
    LIMIT 15
  `);
  console.log("\n=== 最近 15 条匹配分析详情 ===");
  detail.rows.forEach((r) =>
    console.log(`${r.clerkUserId} | analysis=${r.id} | project=${r.projectId} | card=${r.projectCardId} | jd=${r.jdRecordId} | at=${r.createdAt}`)
  );

  await client.end();
})().catch((e) => {
  console.error("查询失败:", e.message);
  process.exit(1);
});
