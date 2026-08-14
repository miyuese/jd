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
  projectId: string | null;
  clerkUserId: string;
  title: string | null;
  background: string | null;
  backgroundFactStatus: string;
  responsibility: string | null;
  responsibilityFactStatus: string;
  result: string | null;
  resultFactStatus: string;
  status: string;
  resumeMaterialId: string | null;
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
    resumeMaterialId: row.resumeMaterialId,
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
             "status", "resumeMaterialId", "createdAt", "updatedAt"
      FROM "ProjectCard"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [projectId, clerkUserId]
  )) as ProjectCardRow[];

  return rows[0] ? mapProjectCard(rows[0]) : null;
}

/** 列出用户全部项目卡片（最新在前；projectId 为空 = 独立卡片库中的卡片）。 */
export async function listProjectCards(clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
             "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
             "status", "resumeMaterialId", "createdAt", "updatedAt"
      FROM "ProjectCard"
      WHERE "clerkUserId" = $1
      ORDER BY "updatedAt" DESC
    `,
    [clerkUserId]
  )) as ProjectCardRow[];

  return rows.map(mapProjectCard);
}

/** 读取卡片关联的项目经历（ProjectCardMaterial 关联表）。 */
export async function listProjectCardMaterials(projectCardId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT pm."id", pm."projectId", pm."clerkUserId", pm."title", pm."projectName", pm."rawText", pm."createdAt", pm."updatedAt"
      FROM "ProjectCardMaterial" AS pcm
      JOIN "ProjectMaterial" AS pm ON pm."id" = pcm."projectMaterialId"
      WHERE pcm."projectCardId" = $1 AND pm."clerkUserId" = $2
      ORDER BY pm."updatedAt" DESC
    `,
    [projectCardId, clerkUserId]
  )) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    projectId: row.projectId ? String(row.projectId) : null,
    clerkUserId: String(row.clerkUserId),
    title: row.title ? String(row.title) : null,
    projectName: row.projectName ? String(row.projectName) : null,
    rawText: String(row.rawText),
    createdAt: row.createdAt as string | Date,
    updatedAt: row.updatedAt as string | Date
  }));
}

export async function saveGeneratedProjectCard(
  clerkUserId: string,
  values: { title: string; background: string; responsibility: string; result: string },
  options: { projectId?: string | null; resumeMaterialId?: string | null; projectMaterialIds?: string[] } = {}
) {
  const sql = getSql();
  const cardId = randomUUID();

  // 多张并存：每次生成新增一条卡片，不再覆盖旧卡片。
  const rows = (await sql.query(
    `
      INSERT INTO "ProjectCard" (
        "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
        "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
        "status", "resumeMaterialId", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, $5, 'NEEDS_CONFIRMATION',
        $6, 'NEEDS_CONFIRMATION', $7, 'NEEDS_CONFIRMATION',
        'PENDING_CONFIRMATION', $8, NOW(), NOW()
      )
      RETURNING "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
                "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
                "status", "resumeMaterialId", "createdAt", "updatedAt"
    `,
    [cardId, options.projectId ?? null, clerkUserId, values.title, values.background, values.responsibility, values.result, options.resumeMaterialId ?? null]
  )) as ProjectCardRow[];

  const card = mapProjectCard(rows[0]);

  // 写卡片 × 项目经历关联
  for (const materialId of options.projectMaterialIds ?? []) {
    await sql.query(
      `
        INSERT INTO "ProjectCardMaterial" ("id", "projectCardId", "projectMaterialId")
        VALUES ($1, $2, $3)
        ON CONFLICT ("projectCardId", "projectMaterialId") DO NOTHING
      `,
      [randomUUID(), card.id, materialId]
    );
  }

  return card;
}

export async function updateProjectCard(
  cardId: string,
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
      WHERE "id" = $9 AND "clerkUserId" = $10
      RETURNING "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
                "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
                "status", "resumeMaterialId", "createdAt", "updatedAt"
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
      clerkUserId
    ]
  )) as ProjectCardRow[];

  return rows[0] ? mapProjectCard(rows[0]) : null;
}

export async function createProjectCardVersion(
  cardId: string,
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
    [randomUUID(), card.projectId, clerkUserId, title, content, card.id]
  )) as VersionRecordRow[];

  return mapVersion(rows[0]);
}

/** 查询卡片版本：优先按 cardId（独立卡片库），否则按项目（兼容旧流程）。 */
export async function listProjectCardVersions(projectId: string | null, clerkUserId: string, cardId?: string) {
  const sql = getSql();

  if (cardId) {
    const rows = (await sql.query(
      `
        SELECT "id", "title", "createdAt"
        FROM "VersionRecord"
        WHERE "sourceProjectCardId" = $1 AND "clerkUserId" = $2 AND "type" = 'PROJECT_CARD'
        ORDER BY "createdAt" DESC
      `,
      [cardId, clerkUserId]
    )) as VersionRecordRow[];

    return rows.map(mapVersion);
  }

  if (!projectId) {
    return [];
  }

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
