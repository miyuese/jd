import "server-only";

import { neon } from "@neondatabase/serverless";

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

function getSql() {
  const connectionString = sanitizeConnectionUrl(process.env.DATABASE_URL);

  if (!connectionString) {
    throw new Error("缺少 DATABASE_URL，无法连接 Neon 数据库。");
  }

  return neon(connectionString);
}

/**
 * 导出当前用户的全部业务数据为 JSON（数据备份）。
 * 注意：不导出任何 API Key / 密钥类字段（AiProviderConfig 仅导出脱敏后的非敏感字段）。
 */
export async function exportAllUserData(clerkUserId: string) {
  const sql = getSql();

  const [
    resumeMaterials,
    projects,
    projectMaterials,
    questionAnswers,
    projectCards,
    jdRecords,
    matchAnalyses,
    versionRecords,
    memorySources,
    abilityTags,
    configRows
  ] = await Promise.all([
    sql.query(`SELECT * FROM "ResumeMaterial" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "Project" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "ProjectMaterial" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "QuestionAnswerRecord" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "ProjectCard" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "JdRecord" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "MatchAnalysis" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "VersionRecord" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "JdMemorySource" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(`SELECT * FROM "JdAbilityTag" WHERE "clerkUserId" = $1 ORDER BY "createdAt" ASC`, [clerkUserId]),
    sql.query(
      `SELECT "providerName", "baseURL", "primaryModel", "fallbackModels" FROM "JdAiProviderConfig" WHERE "ownerUserId" = $1`,
      [clerkUserId]
    )
  ]);

  const sourceIds = (memorySources as Array<{ id: string }>).map((source) => source.id);

  let memoryChunks: Array<Record<string, unknown>> = [];
  let tagChunkLinks: Array<Record<string, unknown>> = [];

  if (sourceIds.length > 0) {
    memoryChunks = (await sql.query(`SELECT * FROM "JdMemoryChunk" WHERE "sourceId" = ANY($1) ORDER BY "chunkIndex" ASC`, [sourceIds])) as Array<Record<string, unknown>>;
  }

  if ((abilityTags as Array<{ id: string }>).length > 0) {
    tagChunkLinks = (await sql.query(
      `SELECT tc."tagId", tc."chunkId"
       FROM "JdMemoryTagChunk" tc
       JOIN "JdAbilityTag" t ON t."id" = tc."tagId"
       WHERE t."clerkUserId" = $1`,
      [clerkUserId]
    )) as Array<Record<string, unknown>>;
  }

  return {
    app: "jd-helper",
    version: 1,
    exportedAt: new Date().toISOString(),
    clerkUserId,
    data: {
      resumeMaterials,
      projects,
      projectMaterials,
      questionAnswers,
      projectCards,
      jdRecords,
      matchAnalyses,
      versionRecords,
      memorySources,
      memoryChunks,
      abilityTags,
      tagChunkLinks,
      aiProviderConfig: (configRows as Array<Record<string, unknown>>).map((row) => ({
        providerName: row.providerName,
        baseURL: row.baseURL,
        primaryModel: row.primaryModel,
        fallbackModels: row.fallbackModels
      }))
    }
  };
}
