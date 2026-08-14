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

type VersionRow = {
  id: string;
  projectId: string;
  type: string;
  title: string;
  content: unknown;
  sourceResumeMaterialId: string | null;
  sourceProjectCardId: string | null;
  sourceMatchAnalysisId: string | null;
  jdRecordId: string | null;
  createdAt: string | Date;
};

export type VersionItem = {
  id: string;
  projectId: string;
  type: string;
  title: string;
  content: unknown;
  sourceResumeMaterialId: string | null;
  sourceProjectCardId: string | null;
  sourceMatchAnalysisId: string | null;
  jdRecordId: string | null;
  createdAt: Date;
};

function mapVersion(row: VersionRow): VersionItem {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    title: row.title,
    content: row.content,
    sourceResumeMaterialId: row.sourceResumeMaterialId,
    sourceProjectCardId: row.sourceProjectCardId,
    sourceMatchAnalysisId: row.sourceMatchAnalysisId,
    jdRecordId: row.jdRecordId,
    createdAt: new Date(row.createdAt)
  };
}

/** 查询版本：支持按项目维度（旧）或交叉点维度（卡片 × JD，新）。 */
export async function listAllVersions(
  projectId: string | null,
  clerkUserId: string,
  cross?: { projectCardId?: string | null; jdRecordId?: string | null }
): Promise<VersionItem[]> {
  const sql = getSql();

  // 交叉点模式：按 卡片 + JD 过滤（来源维度，不依赖 projectId）
  if (cross?.projectCardId && cross?.jdRecordId) {
    const rows = (await sql.query(
      `
        SELECT "id", "projectId", "type", "title", "content",
               "sourceResumeMaterialId", "sourceProjectCardId", "sourceMatchAnalysisId", "jdRecordId", "createdAt"
        FROM "VersionRecord"
        WHERE "clerkUserId" = $1
          AND "sourceProjectCardId" = $2
          AND "jdRecordId" = $3
        ORDER BY "createdAt" DESC
      `,
      [clerkUserId, cross.projectCardId, cross.jdRecordId]
    )) as VersionRow[];

    return rows.map(mapVersion);
  }

  if (!projectId) {
    return [];
  }

  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "type", "title", "content",
             "sourceResumeMaterialId", "sourceProjectCardId", "sourceMatchAnalysisId", "jdRecordId", "createdAt"
      FROM "VersionRecord"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "createdAt" DESC
    `,
    [projectId, clerkUserId]
  )) as VersionRow[];

  return rows.map(mapVersion);
}

export async function getVersionById(versionId: string, clerkUserId: string): Promise<VersionItem | null> {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "type", "title", "content",
             "sourceResumeMaterialId", "sourceProjectCardId", "sourceMatchAnalysisId", "jdRecordId", "createdAt"
      FROM "VersionRecord"
      WHERE "id" = $1 AND "clerkUserId" = $2
      LIMIT 1
    `,
    [versionId, clerkUserId]
  )) as VersionRow[];

  return rows[0] ? mapVersion(rows[0]) : null;
}

export async function listProjectsWithVersions(clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT p."id", p."name", p."targetRole", COUNT(v."id") AS "versionCount"
      FROM "Project" p
      INNER JOIN "VersionRecord" v ON v."projectId" = p."id" AND v."clerkUserId" = p."clerkUserId"
      WHERE p."clerkUserId" = $1
      GROUP BY p."id", p."name", p."targetRole"
      ORDER BY MAX(v."createdAt") DESC
    `,
    [clerkUserId]
  )) as Array<{ id: string; name: string; targetRole: string; versionCount: string }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    targetRole: row.targetRole,
    versionCount: Number(row.versionCount)
  }));
}
