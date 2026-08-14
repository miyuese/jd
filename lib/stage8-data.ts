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

type JdRecordRow = {
  id: string;
  projectId: string;
  clerkUserId: string;
  rawText: string;
  capabilitySummary: unknown;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type MatchAnalysisRow = {
  id: string;
  projectId: string | null;
  jdRecordId: string | null;
  projectCardId: string | null;
  clerkUserId: string;
  status: string;
  matchedPoints: unknown;
  gapPoints: unknown;
  suggestionPoints: unknown;
  summary: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type VersionRecordRow = {
  id: string;
  title: string;
  createdAt: string | Date;
};

function mapJdRecord(row: JdRecordRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    clerkUserId: row.clerkUserId,
    rawText: row.rawText,
    capabilitySummary: row.capabilitySummary,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

function mapMatchAnalysis(row: MatchAnalysisRow) {
  const normalizeGroup = (value: unknown) => {
    if (Array.isArray(value)) {
      return {
        items: value.filter((item): item is string => typeof item === "string"),
        plainExplanation: ""
      };
    }

    if (typeof value === "object" && value !== null) {
      const record = value as { items?: unknown; plainExplanation?: unknown };

      return {
        items: Array.isArray(record.items)
          ? record.items.filter((item): item is string => typeof item === "string")
          : [],
        plainExplanation: typeof record.plainExplanation === "string" ? record.plainExplanation : ""
      };
    }

    return {
      items: [],
      plainExplanation: ""
    };
  };

  const matched = normalizeGroup(row.matchedPoints);
  const gaps = normalizeGroup(row.gapPoints);
  const suggestions = normalizeGroup(row.suggestionPoints);

  return {
    id: row.id,
    projectId: row.projectId,
    jdRecordId: row.jdRecordId,
    projectCardId: row.projectCardId,
    clerkUserId: row.clerkUserId,
    status: row.status,
    matchedPoints: matched.items,
    gapPoints: gaps.items,
    suggestionPoints: suggestions.items,
    plainExplanations: {
      matchedPoints: matched.plainExplanation,
      gapPoints: gaps.plainExplanation,
      suggestionPoints: suggestions.plainExplanation
    },
    summary: row.summary,
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

export async function getLatestJdRecord(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "clerkUserId", "rawText", "capabilitySummary", "createdAt", "updatedAt"
      FROM "JdRecord"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [projectId, clerkUserId]
  )) as JdRecordRow[];

  return rows[0] ? mapJdRecord(rows[0]) : null;
}

export async function saveJdRecord(projectId: string, clerkUserId: string, rawText: string) {
  const sql = getSql();

  // 始终创建新记录（支持同一项目关联多个 JD）
  const rows = (await sql.query(
    `
      INSERT INTO "JdRecord" (
        "id", "projectId", "clerkUserId", "rawText", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING "id", "projectId", "clerkUserId", "rawText", "capabilitySummary", "createdAt", "updatedAt"
    `,
    [randomUUID(), projectId, clerkUserId, rawText]
  )) as JdRecordRow[];

  return mapJdRecord(rows[0]);
}

/** 列出项目的全部 JD 记录（按更新时间倒序），支持多 JD 切换。 */
export async function listJdRecords(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "clerkUserId", "rawText", "capabilitySummary", "createdAt", "updatedAt"
      FROM "JdRecord"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "updatedAt" DESC
    `,
    [projectId, clerkUserId]
  )) as JdRecordRow[];

  return rows.map(mapJdRecord);
}

export async function getJdRecordById(jdRecordId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "clerkUserId", "rawText", "capabilitySummary", "createdAt", "updatedAt"
      FROM "JdRecord"
      WHERE "id" = $1 AND "clerkUserId" = $2
      LIMIT 1
    `,
    [jdRecordId, clerkUserId]
  )) as JdRecordRow[];

  return rows[0] ? mapJdRecord(rows[0]) : null;
}

export async function updateJdCapabilitySummary(jdRecordId: string, capabilitySummary: unknown) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      UPDATE "JdRecord"
      SET "capabilitySummary" = $1::jsonb, "updatedAt" = NOW()
      WHERE "id" = $2
      RETURNING "id", "projectId", "clerkUserId", "rawText", "capabilitySummary", "createdAt", "updatedAt"
    `,
    [JSON.stringify(capabilitySummary), jdRecordId]
  )) as JdRecordRow[];

  return rows[0] ? mapJdRecord(rows[0]) : null;
}

export async function getLatestMatchAnalysis(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "jdRecordId", "clerkUserId", "status", "matchedPoints", "gapPoints", "suggestionPoints", "summary", "createdAt", "updatedAt"
      FROM "MatchAnalysis"
      WHERE "projectId" = $1 AND "clerkUserId" = $2
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [projectId, clerkUserId]
  )) as MatchAnalysisRow[];

  return rows[0] ? mapMatchAnalysis(rows[0]) : null;
}

/** 按指定 JD 获取对应的匹配分析（多 JD 场景下每个 JD 拥有独立的匹配结果；可进一步限定卡片）。 */
export async function getMatchAnalysisByJdRecord(jdRecordId: string, clerkUserId: string, projectCardId?: string | null) {
  if (!jdRecordId) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "projectId", "jdRecordId", "projectCardId", "clerkUserId", "status", "matchedPoints", "gapPoints", "suggestionPoints", "summary", "createdAt", "updatedAt"
      FROM "MatchAnalysis"
      WHERE "jdRecordId" = $1 AND "clerkUserId" = $2
        AND (($3::text IS NULL AND "projectCardId" IS NULL) OR "projectCardId" = $3)
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [jdRecordId, clerkUserId, projectCardId ?? null]
  )) as MatchAnalysisRow[];

  return rows[0] ? mapMatchAnalysis(rows[0]) : null;
}

export async function saveGeneratedMatchAnalysis(
  projectId: string,
  jdRecordId: string,
  clerkUserId: string,
  values: {
    matchedPoints: string[];
    gapPoints: string[];
    suggestionPoints: string[];
    plainExplanations: {
      matchedPoints: string;
      gapPoints: string;
      suggestionPoints: string;
    };
    summary: string;
  },
  projectCardId?: string | null
) {
  const sql = getSql();
  const existing = await getMatchAnalysisByJdRecord(jdRecordId, clerkUserId, projectCardId);
  const matchedPointsPayload = JSON.stringify({ items: values.matchedPoints, plainExplanation: values.plainExplanations.matchedPoints });
  const gapPointsPayload = JSON.stringify({ items: values.gapPoints, plainExplanation: values.plainExplanations.gapPoints });
  const suggestionPointsPayload = JSON.stringify({ items: values.suggestionPoints, plainExplanation: values.plainExplanations.suggestionPoints });

  if (existing) {
    const rows = (await sql.query(
      `
        UPDATE "MatchAnalysis"
        SET "jdRecordId" = $1,
            "projectCardId" = $2,
            "status" = 'PENDING_CONFIRMATION',
            "matchedPoints" = $3::jsonb,
            "gapPoints" = $4::jsonb,
            "suggestionPoints" = $5::jsonb,
            "summary" = $6,
            "updatedAt" = NOW()
        WHERE "id" = $7
        RETURNING "id", "projectId", "jdRecordId", "projectCardId", "clerkUserId", "status", "matchedPoints", "gapPoints", "suggestionPoints", "summary", "createdAt", "updatedAt"
      `,
      [jdRecordId, projectCardId ?? null, matchedPointsPayload, gapPointsPayload, suggestionPointsPayload, values.summary, existing.id]
    )) as MatchAnalysisRow[];

    return mapMatchAnalysis(rows[0]);
  }

  const rows = (await sql.query(
    `
      INSERT INTO "MatchAnalysis" (
        "id", "projectId", "jdRecordId", "projectCardId", "clerkUserId", "status", "matchedPoints", "gapPoints", "suggestionPoints", "summary", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDING_CONFIRMATION', $6::jsonb, $7::jsonb, $8::jsonb, $9, NOW(), NOW())
      RETURNING "id", "projectId", "jdRecordId", "projectCardId", "clerkUserId", "status", "matchedPoints", "gapPoints", "suggestionPoints", "summary", "createdAt", "updatedAt"
    `,
    [randomUUID(), projectId, jdRecordId, projectCardId ?? null, clerkUserId, matchedPointsPayload, gapPointsPayload, suggestionPointsPayload, values.summary]
  )) as MatchAnalysisRow[];

  return mapMatchAnalysis(rows[0]);
}

export async function updateMatchAnalysis(
  matchAnalysisId: string,
  projectId: string,
  clerkUserId: string,
  values: {
    matchedPoints: string[];
    gapPoints: string[];
    suggestionPoints: string[];
    plainExplanations: {
      matchedPoints: string;
      gapPoints: string;
      suggestionPoints: string;
    };
    summary: string;
    status: string;
  }
) {
  const sql = getSql();
  const matchedPointsPayload = JSON.stringify({ items: values.matchedPoints, plainExplanation: values.plainExplanations.matchedPoints });
  const gapPointsPayload = JSON.stringify({ items: values.gapPoints, plainExplanation: values.plainExplanations.gapPoints });
  const suggestionPointsPayload = JSON.stringify({ items: values.suggestionPoints, plainExplanation: values.plainExplanations.suggestionPoints });

  const rows = (await sql.query(
    `
      UPDATE "MatchAnalysis"
      SET "matchedPoints" = $1::jsonb,
          "gapPoints" = $2::jsonb,
          "suggestionPoints" = $3::jsonb,
          "summary" = $4,
          "status" = $5,
          "updatedAt" = NOW()
      WHERE "id" = $6 AND "projectId" = $7 AND "clerkUserId" = $8
      RETURNING "id", "projectId", "jdRecordId", "clerkUserId", "status", "matchedPoints", "gapPoints", "suggestionPoints", "summary", "createdAt", "updatedAt"
    `,
    [matchedPointsPayload, gapPointsPayload, suggestionPointsPayload, values.summary, values.status, matchAnalysisId, projectId, clerkUserId]
  )) as MatchAnalysisRow[];

  return rows[0] ? mapMatchAnalysis(rows[0]) : null;
}

export async function createMatchAnalysisVersion(projectId: string | null, clerkUserId: string, analysis: ReturnType<typeof mapMatchAnalysis>) {
  const sql = getSql();
  const title = `匹配分析版本 · ${new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date())}`;
  const content = JSON.stringify({
    matchedPoints: analysis.matchedPoints,
    gapPoints: analysis.gapPoints,
    suggestionPoints: analysis.suggestionPoints,
    summary: analysis.summary,
    status: analysis.status
  });

  // 版本写入时带上交叉点维度：sourceMatchAnalysisId + sourceProjectCardId + jdRecordId
  const rows = (await sql.query(
    `
      INSERT INTO "VersionRecord" (
        "id", "projectId", "clerkUserId", "type", "title", "content",
        "sourceMatchAnalysisId", "sourceProjectCardId", "jdRecordId", "createdAt"
      )
      VALUES ($1, $2, $3, 'MATCH_ANALYSIS', $4, $5::jsonb, $6, $7, $8, NOW())
      RETURNING "id", "title", "createdAt"
    `,
    [randomUUID(), projectId, clerkUserId, title, content, analysis.id, analysis.projectCardId, analysis.jdRecordId]
  )) as VersionRecordRow[];

  return mapVersion(rows[0]);
}

/** 查询匹配分析版本：优先按交叉点（projectCardId + jdRecordId），否则按项目（兼容旧流程）。 */
export async function listMatchAnalysisVersions(
  projectId: string | null,
  clerkUserId: string,
  cross?: { projectCardId?: string | null; jdRecordId?: string | null }
) {
  const sql = getSql();

  if (cross?.projectCardId && cross?.jdRecordId) {
    const rows = (await sql.query(
      `
        SELECT "id", "title", "createdAt"
        FROM "VersionRecord"
        WHERE "clerkUserId" = $1 AND "type" = 'MATCH_ANALYSIS'
          AND "sourceProjectCardId" = $2 AND "jdRecordId" = $3
        ORDER BY "createdAt" DESC
      `,
      [clerkUserId, cross.projectCardId, cross.jdRecordId]
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
      WHERE "projectId" = $1 AND "clerkUserId" = $2 AND "type" = 'MATCH_ANALYSIS'
      ORDER BY "createdAt" DESC
    `,
    [projectId, clerkUserId]
  )) as VersionRecordRow[];

  return rows.map(mapVersion);
}
