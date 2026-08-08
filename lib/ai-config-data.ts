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

export type AiProviderConfigRow = {
  id: string;
  ownerUserId: string;
  providerName: string;
  baseURL: string;
  apiKey: string;
  primaryModel: string;
  fallbackModels: string[] | null;
  enabled: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function normalizeRow(row: Record<string, unknown>): AiProviderConfigRow {
  return {
    id: String(row.id),
    ownerUserId: String(row.ownerUserId),
    providerName: String(row.providerName),
    baseURL: String(row.baseURL),
    apiKey: String(row.apiKey),
    primaryModel: String(row.primaryModel),
    fallbackModels: Array.isArray(row.fallbackModels)
      ? (row.fallbackModels as unknown[]).filter((item): item is string => typeof item === "string")
      : null,
    enabled: Boolean(row.enabled),
    createdAt: row.createdAt as string | Date,
    updatedAt: row.updatedAt as string | Date
  };
}

/**
 * 读取当前生效的 AI 配置（全局单配置：enabled 的第一条，按更新时间倒序）。
 * 供服务端 AI 调用使用，不按用户隔离。
 */
export async function getActiveAiProviderConfig(): Promise<AiProviderConfigRow | null> {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "ownerUserId", "providerName", "baseURL", "apiKey", "primaryModel", "fallbackModels", "enabled", "createdAt", "updatedAt"
      FROM "JdAiProviderConfig"
      WHERE "enabled" = true
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `
  )) as Array<Record<string, unknown>>;

  return rows.length ? normalizeRow(rows[0]) : null;
}

/** 读取指定 owner 的配置（用于设置页展示与编辑校验）。 */
export async function getAiProviderConfigByOwner(ownerUserId: string): Promise<AiProviderConfigRow | null> {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT "id", "ownerUserId", "providerName", "baseURL", "apiKey", "primaryModel", "fallbackModels", "enabled", "createdAt", "updatedAt"
      FROM "JdAiProviderConfig"
      WHERE "ownerUserId" = $1
      LIMIT 1
    `,
    [ownerUserId]
  )) as Array<Record<string, unknown>>;

  return rows.length ? normalizeRow(rows[0]) : null;
}

/** 新建或覆盖配置（owner 维度唯一，upsert 语义）。 */
export async function upsertAiProviderConfig(input: {
  ownerUserId: string;
  providerName: string;
  baseURL: string;
  apiKey: string;
  primaryModel: string;
  fallbackModels: string[];
}) {
  const sql = getSql();
  const id = randomUUID();

  const rows = (await sql.query(
    `
      INSERT INTO "JdAiProviderConfig" (
        "id", "ownerUserId", "providerName", "baseURL", "apiKey", "primaryModel", "fallbackModels", "enabled", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, true, NOW(), NOW())
      ON CONFLICT ("ownerUserId") DO UPDATE SET
        "providerName" = EXCLUDED."providerName",
        "baseURL" = EXCLUDED."baseURL",
        "apiKey" = EXCLUDED."apiKey",
        "primaryModel" = EXCLUDED."primaryModel",
        "fallbackModels" = EXCLUDED."fallbackModels",
        "enabled" = true,
        "updatedAt" = NOW()
      RETURNING "id", "ownerUserId", "providerName", "baseURL", "apiKey", "primaryModel", "fallbackModels", "enabled", "createdAt", "updatedAt"
    `,
    [
      id,
      input.ownerUserId,
      input.providerName,
      input.baseURL,
      input.apiKey,
      input.primaryModel,
      JSON.stringify(input.fallbackModels)
    ]
  )) as Array<Record<string, unknown>>;

  return normalizeRow(rows[0]);
}

/** 删除配置（回到环境变量兜底）。 */
export async function deleteAiProviderConfig(ownerUserId: string) {
  const sql = getSql();
  await sql.query(
    `
      DELETE FROM "JdAiProviderConfig"
      WHERE "ownerUserId" = $1
    `,
    [ownerUserId]
  );
}
