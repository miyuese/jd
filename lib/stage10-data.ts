import "server-only";

import { randomUUID } from "node:crypto";
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

type VersionRecordRow = {
  id: string;
  title: string;
  content: unknown;
  createdAt: string | Date;
};

function mapVersion(row: VersionRecordRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: new Date(row.createdAt)
  };
}

export async function createInterviewOutputVersion(
  projectId: string,
  clerkUserId: string,
  title: string,
  content: unknown,
  sourceProjectCardId: string | null,
  sourceMatchAnalysisId: string | null
) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      INSERT INTO "VersionRecord" (
        "id", "projectId", "clerkUserId", "type", "title", "content", "sourceProjectCardId", "sourceMatchAnalysisId", "createdAt"
      )
      VALUES ($1, $2, $3, 'OUTPUT', $4, $5::jsonb, $6, $7, NOW())
      RETURNING "id", "title", "content", "createdAt"
    `,
    [randomUUID(), projectId, clerkUserId, title, JSON.stringify(content), sourceProjectCardId, sourceMatchAnalysisId]
  )) as VersionRecordRow[];

  return mapVersion(rows[0]);
}

export async function listInterviewOutputVersions(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "title", "content", "createdAt"
      FROM "VersionRecord"
      WHERE "projectId" = $1 AND "clerkUserId" = $2 AND "type" = 'OUTPUT'
      ORDER BY "createdAt" DESC
    `,
    [projectId, clerkUserId]
  )) as VersionRecordRow[];

  return rows.map(mapVersion);
}
