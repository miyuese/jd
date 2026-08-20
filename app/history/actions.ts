"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { neon } from "@neondatabase/serverless";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listAllVersions, getVersionById, listProjectsWithVersions, type VersionItem } from "@/lib/stage11-data";

export type { VersionItem };

export type ProjectWithVersions = {
  id: string;
  name: string;
  targetRole: string;
  versionCount: number;
};

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

export async function getProjectsWithVersionsAction(): Promise<ProjectWithVersions[]> {
  const userId = requireClerkUserId();
  return listProjectsWithVersions(userId);
}

export async function getProjectVersionsAction(
  projectId: string,
  cross?: { projectCardId?: string | null; jdRecordId?: string | null }
): Promise<VersionItem[]> {
  const userId = requireClerkUserId();
  return listAllVersions(projectId, userId, cross);
}

export async function getVersionDetailAction(versionId: string): Promise<VersionItem | null> {
  const userId = requireClerkUserId();
  return getVersionById(versionId, userId);
}

type DeleteResult = { success: true; message: string } | { success: false; message: string };

/** 删除一条版本记录（校验归属后物理删除，三处版本列表共用）。 */
export async function deleteVersionAction(versionId: string): Promise<DeleteResult> {
  const userId = requireClerkUserId();
  const sql = getSql();

  const rows = (await sql.query(
    `
      DELETE FROM "VersionRecord"
      WHERE "id" = $1 AND "clerkUserId" = $2
      RETURNING "id"
    `,
    [versionId, userId]
  )) as Array<{ id: string }>;

  if (!rows.length) {
    return { success: false, message: "未找到该版本记录，或你无权删除。" };
  }

  revalidatePath("/history");
  revalidatePath("/project-card");
  revalidatePath("/jd-analysis");
  revalidatePath("/cards");

  return { success: true, message: "版本已删除。" };
}

type RestoreResult =
  | { success: true; message: string; redirectTo?: string }
  | { success: false; message: string };

export async function restoreVersionAction(versionId: string): Promise<RestoreResult> {
  const userId = requireClerkUserId();
  const version = await getVersionById(versionId, userId);

  if (!version) {
    return { success: false, message: "未找到该版本记录，或你无权访问。" };
  }

  const sql = getSql();
  const content = version.content as Record<string, unknown>;

  try {
    switch (version.type) {
      case "PROJECT_CARD": {
        const rows = (await sql.query(
          `
            INSERT INTO "ProjectCard" (
              "id", "projectId", "clerkUserId", "title", "background", "backgroundFactStatus",
              "responsibility", "responsibilityFactStatus", "result", "resultFactStatus",
              "status", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            RETURNING "id"
          `,
          [
            randomUUID(),
            version.projectId,
            userId,
            content.title ?? null,
            content.background ?? null,
            content.backgroundFactStatus ?? "NEEDS_CONFIRMATION",
            content.responsibility ?? null,
            content.responsibilityFactStatus ?? "NEEDS_CONFIRMATION",
            content.result ?? null,
            content.resultFactStatus ?? "NEEDS_CONFIRMATION",
            content.status ?? "PENDING_CONFIRMATION"
          ]
        ));

        revalidatePath("/project-card");
        revalidatePath("/history");

        return {
          success: true,
          message: `项目卡片「${content.title ?? "未命名"}」已恢复，可以前往项目卡片页查看。`,
          redirectTo: `/project-card?projectId=${version.projectId}`
        };
      }

      case "MATCH_ANALYSIS": {
        const matchedPointsPayload = JSON.stringify({
          items: Array.isArray(content.matchedPoints) ? content.matchedPoints : [],
          plainExplanation: typeof (content.plainExplanations as Record<string, unknown>)?.matchedPoints === "string"
            ? (content.plainExplanations as Record<string, string>).matchedPoints
            : ""
        });
        const gapPointsPayload = JSON.stringify({
          items: Array.isArray(content.gapPoints) ? content.gapPoints : [],
          plainExplanation: typeof (content.plainExplanations as Record<string, unknown>)?.gapPoints === "string"
            ? (content.plainExplanations as Record<string, string>).gapPoints
            : ""
        });
        const suggestionPointsPayload = JSON.stringify({
          items: Array.isArray(content.suggestionPoints) ? content.suggestionPoints : [],
          plainExplanation: typeof (content.plainExplanations as Record<string, unknown>)?.suggestionPoints === "string"
            ? (content.plainExplanations as Record<string, string>).suggestionPoints
            : ""
        });

        const rows = (await sql.query(
          `
            INSERT INTO "MatchAnalysis" (
              "id", "projectId", "clerkUserId", "status", "matchedPoints", "gapPoints",
              "suggestionPoints", "summary", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, NOW(), NOW())
            RETURNING "id"
          `,
          [
            randomUUID(),
            version.projectId,
            userId,
            content.status ?? "PENDING_CONFIRMATION",
            matchedPointsPayload,
            gapPointsPayload,
            suggestionPointsPayload,
            content.summary ?? null
          ]
        ));

        revalidatePath("/jd-analysis");
        revalidatePath("/history");

        return {
          success: true,
          message: "匹配分析已恢复，可以前往 JD 分析页查看。",
          redirectTo: `/jd-analysis?projectId=${version.projectId}`
        };
      }

      case "OUTPUT": {
        const title = `已恢复 · ${version.title}`;

        await sql.query(
          `
            INSERT INTO "VersionRecord" (
              "id", "projectId", "clerkUserId", "type", "title", "content",
              "sourceProjectCardId", "sourceMatchAnalysisId", "createdAt"
            )
            VALUES ($1, $2, $3, 'OUTPUT', $4, $5::jsonb, $6, $7, NOW())
          `,
          [
            randomUUID(),
            version.projectId,
            userId,
            title,
            JSON.stringify(content),
            version.sourceProjectCardId,
            version.sourceMatchAnalysisId
          ]
        );

        const contentType = content.type as string | undefined;
        let redirectTo = `/interview-prep?projectId=${version.projectId}`;

        if (contentType === "RESUME_REWRITE") {
          redirectTo = `/resume-rewrite?projectId=${version.projectId}`;
        }

        revalidatePath("/interview-prep");
        revalidatePath("/resume-rewrite");
        revalidatePath("/history");

        return {
          success: true,
          message: `版本「${version.title}」已恢复，可以前往对应页面查看。`,
          redirectTo
        };
      }

      default:
        return { success: false, message: `不支持恢复类型为「${version.type}」的版本。` };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "恢复版本失败，请稍后再试。"
    };
  }
}
