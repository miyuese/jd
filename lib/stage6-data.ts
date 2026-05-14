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
  projectId: string;
  clerkUserId: string;
  title: string | null;
  rawText: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type QuestionAnswerRow = {
  id: string;
  projectId: string;
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
    rawText: row.rawText,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

function mapQuestionAnswer(row: QuestionAnswerRow) {
  return {
    id: row.id,
    projectId: row.projectId,
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

export async function saveResumeMaterial(clerkUserId: string, rawText: string) {
  const sql = getSql();
  const existing = await getLatestResumeMaterial(clerkUserId);

  if (existing) {
    const rows = (await sql.query(
      `
        UPDATE "ResumeMaterial"
        SET "rawText" = $1, "title" = COALESCE("title", '已有简历'), "updatedAt" = NOW()
        WHERE "id" = $2
        RETURNING "id", "clerkUserId", "title", "rawText", "createdAt", "updatedAt"
      `,
      [rawText, existing.id]
    )) as ResumeMaterialRow[];

    return mapResumeMaterial(rows[0]);
  }

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

export async function saveProjectMaterial(projectId: string, clerkUserId: string, rawText: string) {
  const sql = getSql();
  const existing = await getLatestProjectMaterial(projectId, clerkUserId);

  if (existing) {
    const rows = (await sql.query(
      `
        UPDATE "ProjectMaterial"
        SET "rawText" = $1, "title" = COALESCE("title", '项目原始材料'), "updatedAt" = NOW()
        WHERE "id" = $2
        RETURNING "id", "projectId", "clerkUserId", "title", "rawText", "createdAt", "updatedAt"
      `,
      [rawText, existing.id]
    )) as ProjectMaterialRow[];

    return mapProjectMaterial(rows[0]);
  }

  const rows = (await sql.query(
    `
      INSERT INTO "ProjectMaterial" (
        "id",
        "projectId",
        "clerkUserId",
        "sourceType",
        "title",
        "rawText",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, 'MANUAL_TEXT', '项目原始材料', $4, NOW(), NOW())
      RETURNING "id", "projectId", "clerkUserId", "title", "rawText", "createdAt", "updatedAt"
    `,
    [randomUUID(), projectId, clerkUserId, rawText]
  )) as ProjectMaterialRow[];

  return mapProjectMaterial(rows[0]);
}

export async function listQuestionAnswerTimeline(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "projectId",
        "clerkUserId",
        "roundIndex",
        "questionText",
        "answerText",
        "createdAt",
        "updatedAt"
      FROM "QuestionAnswerRecord"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "roundIndex" ASC, "createdAt" ASC
    `,
    [projectId, clerkUserId]
  )) as QuestionAnswerRow[];

  return rows.map(mapQuestionAnswer);
}

export async function createQuestionAnswerRecord(
  projectId: string,
  clerkUserId: string,
  questionText: string,
  answerText: string
) {
  const sql = getSql();
  const latestRows = (await sql.query(
    `
      SELECT "roundIndex"
      FROM "QuestionAnswerRecord"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "roundIndex" DESC
      LIMIT 1
    `,
    [projectId, clerkUserId]
  )) as Array<{ roundIndex: number }>;

  const nextRoundIndex = (latestRows[0]?.roundIndex ?? 0) + 1;
  const rows = (await sql.query(
    `
      INSERT INTO "QuestionAnswerRecord" (
        "id",
        "projectId",
        "clerkUserId",
        "roundIndex",
        "questionText",
        "answerText",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING "id", "projectId", "clerkUserId", "roundIndex", "questionText", "answerText", "createdAt", "updatedAt"
    `,
    [randomUUID(), projectId, clerkUserId, nextRoundIndex, questionText, answerText]
  )) as QuestionAnswerRow[];

  return mapQuestionAnswer(rows[0]);
}
