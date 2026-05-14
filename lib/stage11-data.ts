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
    createdAt: new Date(row.createdAt)
  };
}

export async function listAllVersions(projectId: string, clerkUserId: string): Promise<VersionItem[]> {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "type", "title", "content",
             "sourceResumeMaterialId", "sourceProjectCardId", "sourceMatchAnalysisId", "createdAt"
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
             "sourceResumeMaterialId", "sourceProjectCardId", "sourceMatchAnalysisId", "createdAt"
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
