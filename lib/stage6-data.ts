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

type ResumeMaterialRow = {
  id: string;
  clerkUserId: string;
  title: string;
  rawText: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ProjectMaterialRow = {
  id: string;
  projectId: string | null;
  clerkUserId: string;
  title: string | null;
  projectName: string | null;
  rawText: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type QuestionAnswerRow = {
  id: string;
  projectId: string | null;
  projectMaterialId: string | null;
  clerkUserId: string;
  roundIndex: number;
  questionText: string;
  answerText: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function mapResumeMaterial(row: ResumeMaterialRow) {
  return {
    id: row.id,
    clerkUserId: row.clerkUserId,
    title: row.title,
    rawText: row.rawText,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

function mapProjectMaterial(row: ProjectMaterialRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    clerkUserId: row.clerkUserId,
    title: row.title,
    projectName: row.projectName,
    rawText: row.rawText,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

function mapQuestionAnswer(row: QuestionAnswerRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    projectMaterialId: row.projectMaterialId,
    clerkUserId: row.clerkUserId,
    roundIndex: row.roundIndex,
    questionText: row.questionText,
    answerText: row.answerText,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

export async function getLatestResumeMaterial(clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "clerkUserId",
        "title",
        "rawText",
        "createdAt",
        "updatedAt"
      FROM "ResumeMaterial"
      WHERE "clerkUserId" = $1
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [clerkUserId]
  )) as ResumeMaterialRow[];

  const material = rows[0];

  return material ? mapResumeMaterial(material) : null;
}

/** 列出用户全部简历版本（最新在前）。 */
export async function listResumeMaterials(clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "clerkUserId",
        "title",
        "rawText",
        "createdAt",
        "updatedAt"
      FROM "ResumeMaterial"
      WHERE "clerkUserId" = $1
      ORDER BY "updatedAt" DESC
    `,
    [clerkUserId]
  )) as ResumeMaterialRow[];

  return rows.map(mapResumeMaterial);
}

/** 按 id 查询用户的一份简历材料。 */
export async function getResumeMaterialById(materialId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "clerkUserId",
        "title",
        "rawText",
        "createdAt",
        "updatedAt"
      FROM "ResumeMaterial"
      WHERE "id" = $1 AND "clerkUserId" = $2
      LIMIT 1
    `,
    [materialId, clerkUserId]
  )) as ResumeMaterialRow[];

  return rows[0] ? mapResumeMaterial(rows[0]) : null;
}

export async function saveResumeMaterial(clerkUserId: string, rawText: string) {
  const sql = getSql();

  // 多份并存：每次保存新增一条记录，不再覆盖旧版本。
  const rows = (await sql.query(
    `
      INSERT INTO "ResumeMaterial" (
        "id",
        "clerkUserId",
        "title",
        "rawText",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, '已有简历', $3, NOW(), NOW())
      RETURNING "id", "clerkUserId", "title", "rawText", "createdAt", "updatedAt"
    `,
    [randomUUID(), clerkUserId, rawText]
  )) as ResumeMaterialRow[];

  return mapResumeMaterial(rows[0]);
}

export async function getLatestProjectMaterial(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "projectId",
        "clerkUserId",
        "title",
        "projectName",
        "rawText",
        "createdAt",
        "updatedAt"
      FROM "ProjectMaterial"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [projectId, clerkUserId]
  )) as ProjectMaterialRow[];

  const material = rows[0];

  return material ? mapProjectMaterial(material) : null;
}

/** 列出用户的全部项目经历（多份并存，最新在前；projectId 为空表示已独立于计划）。 */
export async function listProjectMaterials(clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "projectId",
        "clerkUserId",
        "title",
        "projectName",
        "rawText",
        "createdAt",
        "updatedAt"
      FROM "ProjectMaterial"
      WHERE "clerkUserId" = $1
      ORDER BY "updatedAt" DESC
    `,
    [clerkUserId]
  )) as ProjectMaterialRow[];

  return rows.map(mapProjectMaterial);
}

/** 按 id 查询用户的一条项目经历素材。 */
export async function getProjectMaterialById(materialId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "projectId",
        "clerkUserId",
        "title",
        "projectName",
        "rawText",
        "createdAt",
        "updatedAt"
      FROM "ProjectMaterial"
      WHERE "id" = $1 AND "clerkUserId" = $2
      LIMIT 1
    `,
    [materialId, clerkUserId]
  )) as ProjectMaterialRow[];

  return rows[0] ? mapProjectMaterial(rows[0]) : null;
}

/** 删除一条项目经历素材（级联删除其问答与卡片关联）。 */
export async function deleteProjectMaterial(materialId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      DELETE FROM "ProjectMaterial"
      WHERE "id" = $1 AND "clerkUserId" = $2
      RETURNING "id"
    `,
    [materialId, clerkUserId]
  )) as Array<{ id: string }>;

  return rows[0] ?? null;
}

/** 原地更新一条项目经历素材（修正内容用，不新增版本）。 */
export async function updateProjectMaterial(
  materialId: string,
  clerkUserId: string,
  values: { projectName?: string; rawText?: string }
) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      UPDATE "ProjectMaterial"
      SET "projectName" = COALESCE($1, "projectName"),
          "title" = COALESCE($1, "title"),
          "rawText" = COALESCE($2, "rawText"),
          "updatedAt" = NOW()
      WHERE "id" = $3 AND "clerkUserId" = $4
      RETURNING "id", "projectId", "clerkUserId", "title", "projectName", "rawText", "createdAt", "updatedAt"
    `,
    [values.projectName ?? null, values.rawText ?? null, materialId, clerkUserId]
  )) as ProjectMaterialRow[];

  return rows[0] ? mapProjectMaterial(rows[0]) : null;
}

export async function saveProjectMaterial(
  clerkUserId: string,
  rawText: string,
  options: { projectId?: string | null; title?: string; projectName?: string } = {}
) {
  const sql = getSql();

  // 多份并存：每次保存新增一条记录，不再覆盖旧版本。
  const rows = (await sql.query(
    `
      INSERT INTO "ProjectMaterial" (
        "id",
        "projectId",
        "clerkUserId",
        "sourceType",
        "title",
        "projectName",
        "rawText",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, 'MANUAL_TEXT', $4, $5, $6, NOW(), NOW())
      RETURNING "id", "projectId", "clerkUserId", "title", "projectName", "rawText", "createdAt", "updatedAt"
    `,
    [randomUUID(), options.projectId ?? null, clerkUserId, options.title ?? "项目原始材料", options.projectName ?? null, rawText]
  )) as ProjectMaterialRow[];

  return mapProjectMaterial(rows[0]);
}

/**
 * 查询问答时间线。
 * 优先按 projectMaterialId（项目经历素材）查询；传入 projectId 且不传 materialId 时按项目查询（兼容旧流程）。
 */
export async function listQuestionAnswerTimeline(
  target: { projectId?: string | null; projectMaterialId?: string | null },
  clerkUserId: string
) {
  const sql = getSql();

  if (target.projectMaterialId) {
    const rows = (await sql.query(
      `
        SELECT
          "id", "projectId", "projectMaterialId", "clerkUserId", "roundIndex", "questionText", "answerText", "createdAt", "updatedAt"
        FROM "QuestionAnswerRecord"
        WHERE "projectMaterialId" = $1 AND "clerkUserId" = $2
        ORDER BY "roundIndex" ASC, "createdAt" ASC
      `,
      [target.projectMaterialId, clerkUserId]
    )) as QuestionAnswerRow[];

    return rows.map(mapQuestionAnswer);
  }

  if (target.projectId) {
    const rows = (await sql.query(
      `
        SELECT
          "id", "projectId", "projectMaterialId", "clerkUserId", "roundIndex", "questionText", "answerText", "createdAt", "updatedAt"
        FROM "QuestionAnswerRecord"
        WHERE "projectId" = $1 AND "clerkUserId" = $2
        ORDER BY "roundIndex" ASC, "createdAt" ASC
      `,
      [target.projectId, clerkUserId]
    )) as QuestionAnswerRow[];

    return rows.map(mapQuestionAnswer);
  }

  return [];
}

export async function createQuestionAnswerRecord(
  target: { projectId?: string | null; projectMaterialId?: string | null },
  clerkUserId: string,
  questionText: string,
  answerText: string
) {
  const sql = getSql();
  const scopeId = target.projectMaterialId ?? target.projectId ?? null;
  const scopeColumn = target.projectMaterialId ? "projectMaterialId" : "projectId";

  const latestRows = (await sql.query(
    `
      SELECT "roundIndex"
      FROM "QuestionAnswerRecord"
      WHERE "${scopeColumn}" = $1 AND "clerkUserId" = $2
      ORDER BY "roundIndex" DESC
      LIMIT 1
    `,
    [scopeId, clerkUserId]
  )) as Array<{ roundIndex: number }>;

  const nextRoundIndex = (latestRows[0]?.roundIndex ?? 0) + 1;
  const rows = (await sql.query(
    `
      INSERT INTO "QuestionAnswerRecord" (
        "id",
        "projectId",
        "projectMaterialId",
        "clerkUserId",
        "roundIndex",
        "questionText",
        "answerText",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING "id", "projectId", "projectMaterialId", "clerkUserId", "roundIndex", "questionText", "answerText", "createdAt", "updatedAt"
    `,
    [
      randomUUID(),
      target.projectId ?? null,
      target.projectMaterialId ?? null,
      clerkUserId,
      nextRoundIndex,
      questionText,
      answerText
    ]
  )) as QuestionAnswerRow[];

  return mapQuestionAnswer(rows[0]);
}
