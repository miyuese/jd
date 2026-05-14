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

type ProjectCardRow = {
  id: string;
  projectId: string;
  clerkUserId: string;
  title: string | null;
  background: string | null;
  backgroundFactStatus: string;
  responsibility: string | null;
  responsibilityFactStatus: string;
  result: string | null;
  resultFactStatus: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type VersionRecordRow = {
  id: string;
  title: string;
  createdAt: string | Date;
};

function mapProjectCard(row: ProjectCardRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    clerkUserId: row.clerkUserId,
    title: row.title,
    background: row.background,
    backgroundFactStatus: row.backgroundFactStatus,
    responsibility: row.responsibility,
    responsibilityFactStatus: row.responsibilityFactStatus,
    result: row.result,
    resultFactStatus: row.resultFactStatus,
    status: row.status,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

function mapVersion(row: VersionRecordRow) {
  return {
    id: row.id,
    title: row.title,
    createdAt: new Date(row.createdAt)
  };
}

export async function getLatestProjectCard(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
             "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
             "status", "createdAt", "updatedAt"
      FROM "ProjectCard"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [projectId, clerkUserId]
  )) as ProjectCardRow[];

  return rows[0] ? mapProjectCard(rows[0]) : null;
}

export async function saveGeneratedProjectCard(
  projectId: string,
  clerkUserId: string,
  values: { title: string; background: string; responsibility: string; result: string }
) {
  const sql = getSql();
  const existing = await getLatestProjectCard(projectId, clerkUserId);

  if (existing) {
    const rows = (await sql.query(
      `
        UPDATE "ProjectCard"
        SET "title" = $1,
            "background" = $2,
            "backgroundFactStatus" = 'NEEDS_CONFIRMATION',
            "responsibility" = $3,
            "responsibilityFactStatus" = 'NEEDS_CONFIRMATION',
            "result" = $4,
            "resultFactStatus" = 'NEEDS_CONFIRMATION',
            "status" = 'PENDING_CONFIRMATION',
            "updatedAt" = NOW()
        WHERE "id" = $5
        RETURNING "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
                  "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
                  "status", "createdAt", "updatedAt"
      `,
      [values.title, values.background, values.responsibility, values.result, existing.id]
    )) as ProjectCardRow[];

    return mapProjectCard(rows[0]);
  }

  const rows = (await sql.query(
    `
      INSERT INTO "ProjectCard" (
        "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
        "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
        "status", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, $5, 'NEEDS_CONFIRMATION',
        $6, 'NEEDS_CONFIRMATION', $7, 'NEEDS_CONFIRMATION',
        'PENDING_CONFIRMATION', NOW(), NOW()
      )
      RETURNING "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
                "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
                "status", "createdAt", "updatedAt"
    `,
    [randomUUID(), projectId, clerkUserId, values.title, values.background, values.responsibility, values.result]
  )) as ProjectCardRow[];

  return mapProjectCard(rows[0]);
}

export async function updateProjectCard(
  cardId: string,
  projectId: string,
  clerkUserId: string,
  values: {
    title: string;
    background: string;
    backgroundFactStatus: string;
    responsibility: string;
    responsibilityFactStatus: string;
    result: string;
    resultFactStatus: string;
    status: string;
  }
) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      UPDATE "ProjectCard"
      SET "title" = $1,
          "background" = $2,
          "backgroundFactStatus" = $3,
          "responsibility" = $4,
          "responsibilityFactStatus" = $5,
          "result" = $6,
          "resultFactStatus" = $7,
          "status" = $8,
          "updatedAt" = NOW()
      WHERE "id" = $9 AND "projectId" = $10 AND "clerkUserId" = $11
      RETURNING "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
                "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
                "status", "createdAt", "updatedAt"
    `,
    [
      values.title,
      values.background,
      values.backgroundFactStatus,
      values.responsibility,
      values.responsibilityFactStatus,
      values.result,
      values.resultFactStatus,
      values.status,
      cardId,
      projectId,
      clerkUserId
    ]
  )) as ProjectCardRow[];

  return rows[0] ? mapProjectCard(rows[0]) : null;
}

export async function createProjectCardVersion(
  projectId: string,
  clerkUserId: string,
  card: ReturnType<typeof mapProjectCard>
) {
  const sql = getSql();
  const title = `${card.title || "项目卡片"} · ${new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date())}`;
  const content = JSON.stringify({
    title: card.title,
    background: card.background,
    backgroundFactStatus: card.backgroundFactStatus,
    responsibility: card.responsibility,
    responsibilityFactStatus: card.responsibilityFactStatus,
    result: card.result,
    resultFactStatus: card.resultFactStatus,
    status: card.status
  });

  const rows = (await sql.query(
    `
      INSERT INTO "VersionRecord" (
        "id", "projectId", "clerkUserId", "type", "title", "content", "sourceProjectCardId", "createdAt"
      )
      VALUES ($1, $2, $3, 'PROJECT_CARD', $4, $5::jsonb, $6, NOW())
      RETURNING "id", "title", "createdAt"
    `,
    [randomUUID(), projectId, clerkUserId, title, content, card.id]
  )) as VersionRecordRow[];

  return mapVersion(rows[0]);
}

export async function listProjectCardVersions(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "title", "createdAt"
      FROM "VersionRecord"
      WHERE "projectId" = $1 AND "clerkUserId" = $2 AND "type" = 'PROJECT_CARD'
      ORDER BY "createdAt" DESC
    `,
    [projectId, clerkUserId]
  )) as VersionRecordRow[];

  return rows.map(mapVersion);
}
