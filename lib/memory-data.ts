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

// ========== 类型定义 ==========

export type MemorySourceType = "RESUME" | "PROJECT_MATERIAL" | "INTERVIEW_ANSWER" | "INTERVIEW_FEEDBACK" | "REFLECTION" | "MANUAL";
export type AbilityCategory = "PERSONA" | "GENERAL" | "ROLE_SPECIFIC";
export type TagStatus = "DRAFT" | "CONFIRMED" | "REJECTED";
export type CitationKind = "DIRECT_QUOTE" | "PARAPHRASE" | "INFERENCE";

export type MemorySourceRow = {
  id: string;
  clerkUserId: string;
  sourceType: MemorySourceType;
  title: string | null;
  rawText: string;
  sourceRefId: string | null;
  projectId: string | null;
  createdAt: string | Date;
};

export type MemoryChunkRow = {
  id: string;
  sourceId: string;
  content: string;
  chunkIndex: number;
  createdAt: string | Date;
};

export type AbilityTagRow = {
  id: string;
  clerkUserId: string;
  name: string;
  category: AbilityCategory;
  description: string | null;
  confidence: number;
  status: TagStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type OutputCitationRow = {
  id: string;
  clerkUserId: string;
  versionId: string;
  sentenceId: string;
  chunkId: string;
  kind: CitationKind;
  createdAt: string | Date;
};

// ========== 分块工具 ==========

export function splitIntoChunks(text: string, maxLength = 500): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  const pushBuffer = () => {
    if (buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = "";
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLength) {
      if (buffer && buffer.length + paragraph.length + 1 > maxLength) {
        pushBuffer();
      }

      buffer = buffer ? `${buffer}\n${paragraph}` : paragraph;
      continue;
    }

    // 长段落按句子切分
    const sentences = paragraph.split(/(?<=[。！？!?；;])/);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();

      if (!trimmed) {
        continue;
      }

      if (trimmed.length <= maxLength) {
        if (buffer && buffer.length + trimmed.length + 1 > maxLength) {
          pushBuffer();
        }

        buffer = buffer ? `${buffer}${trimmed}` : trimmed;
        continue;
      }

      // 超长句子硬切
      pushBuffer();
      for (let i = 0; i < trimmed.length; i += maxLength) {
        chunks.push(trimmed.slice(i, i + maxLength));
      }
    }
  }

  pushBuffer();

  return chunks;
}

// ========== 记忆源 ==========

export async function createMemorySource(input: {
  clerkUserId: string;
  sourceType: MemorySourceType;
  title?: string;
  rawText: string;
  sourceRefId?: string;
  projectId?: string;
}) {
  const sql = getSql();
  const id = randomUUID();
  const rows = (await sql.query(
    `
      INSERT INTO "JdMemorySource" (
        "id", "clerkUserId", "sourceType", "title", "rawText", "sourceRefId", "projectId", "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING "id", "clerkUserId", "sourceType", "title", "rawText", "sourceRefId", "projectId", "createdAt"
    `,
    [id, input.clerkUserId, input.sourceType, input.title ?? null, input.rawText, input.sourceRefId ?? null, input.projectId ?? null]
  )) as MemorySourceRow[];

  return rows[0];
}

export async function createMemoryChunks(sourceId: string, chunks: string[]) {
  if (chunks.length === 0) {
    return [];
  }

  const sql = getSql();
  const inserted: MemoryChunkRow[] = [];

  // 分小批插入，避免超长参数
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20);
    const values: string[] = [];
    const params: unknown[] = [];

    batch.forEach((content, offset) => {
      const base = offset * 3;
      params.push(randomUUID(), sourceId, content);
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, ${i + offset}, NOW())`);
    });

    const rows = (await sql.query(
      `
        INSERT INTO "JdMemoryChunk" ("id", "sourceId", "content", "chunkIndex", "createdAt")
        VALUES ${values.join(", ")}
        RETURNING "id", "sourceId", "content", "chunkIndex", "createdAt"
      `,
      params
    )) as MemoryChunkRow[];

    inserted.push(...rows);
  }

  return inserted;
}

/**
 * 一站式入库：创建记忆源 + 分块存储
 */
export async function ingestText(input: {
  clerkUserId: string;
  sourceType: MemorySourceType;
  title?: string;
  rawText: string;
  sourceRefId?: string;
  projectId?: string;
}) {
  const source = await createMemorySource(input);
  const chunks = splitIntoChunks(input.rawText);
  const chunkRows = await createMemoryChunks(source.id, chunks);

  return {
    source,
    chunks: chunkRows
  };
}

export async function listMemorySources(clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "clerkUserId", "sourceType", "title", "rawText", "sourceRefId", "projectId", "createdAt"
      FROM "JdMemorySource"
      WHERE "clerkUserId" = $1
      ORDER BY "createdAt" DESC
    `,
    [clerkUserId]
  )) as MemorySourceRow[];

  return rows;
}

export async function getMemorySourceById(sourceId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "clerkUserId", "sourceType", "title", "rawText", "sourceRefId", "projectId", "createdAt"
      FROM "JdMemorySource"
      WHERE "id" = $1 AND "clerkUserId" = $2
      LIMIT 1
    `,
    [sourceId, clerkUserId]
  )) as MemorySourceRow[];

  return rows[0] ?? null;
}

/** 按来源业务记录 id 查询记忆源（用于自动入库幂等去重）。 */
export async function findMemorySourceByRef(clerkUserId: string, sourceRefId: string) {
  if (!sourceRefId) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "clerkUserId", "sourceType", "title", "rawText", "sourceRefId", "projectId", "createdAt"
      FROM "JdMemorySource"
      WHERE "clerkUserId" = $1 AND "sourceRefId" = $2
      LIMIT 1
    `,
    [clerkUserId, sourceRefId]
  )) as MemorySourceRow[];

  return rows[0] ?? null;
}

export async function deleteMemorySource(sourceId: string, clerkUserId: string) {
  const sql = getSql();
  await sql.query(
    `
      DELETE FROM "JdMemorySource"
      WHERE "id" = $1 AND "clerkUserId" = $2
    `,
    [sourceId, clerkUserId]
  );
}

export async function listChunksBySource(sourceId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "sourceId", "content", "chunkIndex", "createdAt"
      FROM "JdMemoryChunk"
      WHERE "sourceId" = $1
      ORDER BY "chunkIndex" ASC
    `,
    [sourceId]
  )) as MemoryChunkRow[];

  return rows;
}

// ========== 能力标签 ==========

export async function createAbilityTag(input: {
  clerkUserId: string;
  name: string;
  category: AbilityCategory;
  description?: string;
  confidence: number;
  status?: TagStatus;
}) {
  const sql = getSql();
  const id = randomUUID();
  const rows = (await sql.query(
    `
      INSERT INTO "JdAbilityTag" (
        "id", "clerkUserId", "name", "category", "description", "confidence", "status", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING "id", "clerkUserId", "name", "category", "description", "confidence", "status", "createdAt", "updatedAt"
    `,
    [id, input.clerkUserId, input.name, input.category, input.description ?? null, input.confidence, input.status ?? "DRAFT"]
  )) as AbilityTagRow[];

  return rows[0];
}

export async function listAbilityTags(clerkUserId: string, category?: AbilityCategory) {
  const sql = getSql();
  const params: unknown[] = [clerkUserId];

  let categoryClause = "";
  if (category) {
    params.push(category);
    categoryClause = ` AND "category" = $${params.length}`;
  }

  const rows = (await sql.query(
    `
      SELECT "id", "clerkUserId", "name", "category", "description", "confidence", "status", "createdAt", "updatedAt"
      FROM "JdAbilityTag"
      WHERE "clerkUserId" = $1${categoryClause}
      ORDER BY "createdAt" DESC
    `,
    params
  )) as AbilityTagRow[];

  return rows;
}

export async function getAbilityTagById(tagId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "clerkUserId", "name", "category", "description", "confidence", "status", "createdAt", "updatedAt"
      FROM "JdAbilityTag"
      WHERE "id" = $1 AND "clerkUserId" = $2
      LIMIT 1
    `,
    [tagId, clerkUserId]
  )) as AbilityTagRow[];

  return rows[0] ?? null;
}

export async function updateAbilityTagStatus(tagId: string, clerkUserId: string, status: TagStatus) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      UPDATE "JdAbilityTag"
      SET "status" = $1, "updatedAt" = NOW()
      WHERE "id" = $2 AND "clerkUserId" = $3
      RETURNING "id", "clerkUserId", "name", "category", "description", "confidence", "status", "createdAt", "updatedAt"
    `,
    [status, tagId, clerkUserId]
  )) as AbilityTagRow[];

  return rows[0] ?? null;
}

/** 删除单个能力标签（级联清理 JdMemoryTagChunk 关联，来源证据不受影响）。 */
export async function deleteAbilityTag(tagId: string, clerkUserId: string) {
  const sql = getSql();
  await sql.query(
    `
      DELETE FROM "JdAbilityTag"
      WHERE "id" = $1 AND "clerkUserId" = $2
    `,
    [tagId, clerkUserId]
  );
}

/** 批量删除能力标签，返回实际删除数量（级联清理 JdMemoryTagChunk 关联）。 */
export async function deleteAbilityTags(tagIds: string[], clerkUserId: string) {
  if (tagIds.length === 0) {
    return 0;
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      DELETE FROM "JdAbilityTag"
      WHERE "id" = ANY($1) AND "clerkUserId" = $2
      RETURNING "id"
    `,
    [tagIds, clerkUserId]
  )) as Array<{ id: string }>;

  return rows.length;
}

// ========== 输出引用 ==========

export async function createOutputCitation(input: {
  clerkUserId: string;
  versionId: string;
  sentenceId: string;
  chunkId: string;
  kind: CitationKind;
}) {
  const sql = getSql();
  const id = randomUUID();
  const rows = (await sql.query(
    `
      INSERT INTO "JdOutputCitation" (
        "id", "clerkUserId", "versionId", "sentenceId", "chunkId", "kind", "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING "id", "clerkUserId", "versionId", "sentenceId", "chunkId", "kind", "createdAt"
    `,
    [id, input.clerkUserId, input.versionId, input.sentenceId, input.chunkId, input.kind]
  )) as OutputCitationRow[];

  return rows[0];
}

export async function listCitationsByVersion(versionId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "clerkUserId", "versionId", "sentenceId", "chunkId", "kind", "createdAt"
      FROM "JdOutputCitation"
      WHERE "versionId" = $1 AND "clerkUserId" = $2
      ORDER BY "createdAt" ASC
    `,
    [versionId, clerkUserId]
  )) as OutputCitationRow[];

  return rows;
}

// ========== 标签 ↔ 证据关联（memory_tag_chunk 链接表） ==========

export async function linkTagToChunks(tagId: string, chunkIds: string[]) {
  if (chunkIds.length === 0) {
    return;
  }

  const sql = getSql();

  for (let i = 0; i < chunkIds.length; i += 20) {
    const batch = chunkIds.slice(i, i + 20);
    const values: string[] = [];
    const params: unknown[] = [];

    batch.forEach((chunkId, offset) => {
      const base = offset * 2;
      params.push(tagId, chunkId);
      values.push(`($${base + 1}, $${base + 2})`);
    });

    await sql.query(
      `
        INSERT INTO "JdMemoryTagChunk" ("tagId", "chunkId")
        VALUES ${values.join(", ")}
        ON CONFLICT ("tagId", "chunkId") DO NOTHING
      `,
      params
    );
  }
}

export async function listChunksByTag(tagId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT c."id", c."sourceId", c."content", c."chunkIndex", c."createdAt",
             s."title" AS "sourceTitle", s."sourceType"
      FROM "JdMemoryTagChunk" tc
      JOIN "JdMemoryChunk" c ON c."id" = tc."chunkId"
      JOIN "JdMemorySource" s ON s."id" = c."sourceId"
      WHERE tc."tagId" = $1
      ORDER BY c."chunkIndex" ASC
    `,
    [tagId]
  )) as Array<MemoryChunkRow & { sourceTitle: string | null; sourceType: MemorySourceType }>;

  return rows;
}

// ========== 能力画像统计（雷达图用） ==========

export type AbilityTagStats = {
  PERSONA: { count: number; avgConfidence: number };
  GENERAL: { count: number; avgConfidence: number };
  ROLE_SPECIFIC: { count: number; avgConfidence: number };
};

/**
 * 按三层能力分类聚合当前用户的标签统计，用于"能力画像 vs JD 匹配"雷达图。
 */
export async function getAbilityTagStats(clerkUserId: string): Promise<AbilityTagStats> {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "category",
             COUNT(*)::int AS "count",
             COALESCE(AVG("confidence")::float8, 0) AS "avgConfidence"
      FROM "JdAbilityTag"
      WHERE "clerkUserId" = $1
      GROUP BY "category"
    `,
    [clerkUserId]
  )) as Array<{ category: AbilityCategory; count: number; avgConfidence: number }>;

  const stats: AbilityTagStats = {
    PERSONA: { count: 0, avgConfidence: 0 },
    GENERAL: { count: 0, avgConfidence: 0 },
    ROLE_SPECIFIC: { count: 0, avgConfidence: 0 }
  };

  for (const row of rows) {
    stats[row.category] = {
      count: row.count,
      avgConfidence: row.avgConfidence ?? 0
    };
  }

  return stats;
}

// ========== 能力缺口（面试反馈回流，闭环最后环节） ==========

export type AbilityGapItem = {
  tagId: string;
  name: string;
  description: string | null;
  confidence: number;
  status: TagStatus;
  updatedAt: string | Date;
  evidence: Array<{
    chunkId: string;
    content: string;
    sourceTitle: string | null;
    sourceType: MemorySourceType | null;
  }>;
};

/**
 * 查询当前用户的全部能力缺口标签（「缺口：」前缀，来自面试反馈回流）。
 * 这些标签会进入简历改写 / 面试准备的「补强建议」区块，形成数据飞轮闭环。
 */
export async function listAbilityGaps(clerkUserId: string): Promise<AbilityGapItem[]> {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT t."id" AS "tagId", t."name", t."description", t."confidence", t."status", t."updatedAt",
             c."id" AS "chunkId", c."content",
             s."title" AS "sourceTitle", s."sourceType"
      FROM "JdAbilityTag" t
      LEFT JOIN "JdMemoryTagChunk" tc ON tc."tagId" = t."id"
      LEFT JOIN "JdMemoryChunk" c ON c."id" = tc."chunkId"
      LEFT JOIN "JdMemorySource" s ON s."id" = c."sourceId"
      WHERE t."clerkUserId" = $1 AND t."name" LIKE '缺口：%'
      ORDER BY t."updatedAt" DESC, c."chunkIndex" ASC
    `,
    [clerkUserId]
  )) as Array<{
    tagId: string;
    name: string;
    description: string | null;
    confidence: number;
    status: TagStatus;
    updatedAt: string | Date;
    chunkId: string | null;
    content: string | null;
    sourceTitle: string | null;
    sourceType: MemorySourceType | null;
  }>;

  const grouped = new Map<string, AbilityGapItem>();

  for (const row of rows) {
    let item = grouped.get(row.tagId);

    if (!item) {
      item = {
        tagId: row.tagId,
        name: row.name,
        description: row.description,
        confidence: row.confidence,
        status: row.status,
        updatedAt: row.updatedAt,
        evidence: []
      };
      grouped.set(row.tagId, item);
    }

    if (row.chunkId && row.content) {
      item.evidence.push({
        chunkId: row.chunkId,
        content: row.content,
        sourceTitle: row.sourceTitle,
        sourceType: row.sourceType
      });
    }
  }

  return Array.from(grouped.values());
}

/** 批量查询多个标签的证据（修复 N+1 查询）。返回按标签分组的证据映射。 */
export async function listChunksByTagIds(tagIds: string[]) {
  if (tagIds.length === 0) {
    return new Map<string, Array<{ chunkId: string; content: string; sourceTitle: string | null; sourceType: MemorySourceType | null }>>();
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT tc."tagId", c."id" AS "chunkId", c."content",
             s."title" AS "sourceTitle", s."sourceType"
      FROM "JdMemoryTagChunk" tc
      JOIN "JdMemoryChunk" c ON c."id" = tc."chunkId"
      JOIN "JdMemorySource" s ON s."id" = c."sourceId"
      WHERE tc."tagId" = ANY($1)
      ORDER BY c."chunkIndex" ASC
    `,
    [tagIds]
  )) as Array<{
    tagId: string;
    chunkId: string;
    content: string;
    sourceTitle: string | null;
    sourceType: MemorySourceType | null;
  }>;

  const grouped = new Map<string, Array<{ chunkId: string; content: string; sourceTitle: string | null; sourceType: MemorySourceType | null }>>();

  for (const row of rows) {
    const list = grouped.get(row.tagId) ?? [];
    list.push({
      chunkId: row.chunkId,
      content: row.content,
      sourceTitle: row.sourceTitle,
      sourceType: row.sourceType
    });
    grouped.set(row.tagId, list);
  }

  return grouped;
}
