"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import { generateProjectCardDraft } from "@/lib/ai-config";
import { getWorkspaceProjectById } from "@/lib/neon-db";
import { getLatestProjectMaterial, listQuestionAnswerTimeline } from "@/lib/stage6-data";
import {
  createProjectCardVersion,
  getLatestProjectCard,
  saveGeneratedProjectCard,
  updateProjectCard
} from "@/lib/stage7-data";

const factStatusSchema = z.enum(["CONFIRMED", "NEEDS_CONFIRMATION", "EXPRESSION_SUGGESTION"]);
const cardStatusSchema = z.enum(["DRAFT", "PENDING_CONFIRMATION", "CONFIRMED"]);

const updateProjectCardSchema = z.object({
  projectId: z.string().trim().min(1, "缺少项目信息，请重新选择项目。").optional(),
  cardId: z.string().trim().min(1, "当前还没有可编辑的项目卡片草稿。"),
  title: z.string().trim().min(1, "请填写项目卡片标题。"),
  background: z.string().trim().min(1, "请填写项目背景。"),
  backgroundFactStatus: factStatusSchema,
  responsibility: z.string().trim().min(1, "请填写项目职责。"),
  responsibilityFactStatus: factStatusSchema,
  result: z.string().trim().min(1, "请填写项目结果。"),
  resultFactStatus: factStatusSchema,
  status: cardStatusSchema
});

type ActionResult =
  | {
      success: true;
      message: string;
      savedAt?: string;
      model?: string;
      data?: unknown;
    }
  | {
      success: false;
      message: string;
    };

export async function generateProjectCardDraftAction(
  projectId: string | null,
  options: {
    resumeMaterialId?: string;
    projectMaterialIds?: string[];
    confirmedFields?: {
      title?: string;
      background?: string;
      responsibility?: string;
      result?: string;
    };
  } = {}
): Promise<ActionResult> {
  const userId = requireClerkUserId();

  // 组合模式：明确传入简历 + 多份经历时，直接用选中的材料（素材驱动，不依赖求职计划）
  let materials: Array<{ projectName: string; text: string }> = [];
  let resumeMaterialId = options.resumeMaterialId ?? null;

  if (options.projectMaterialIds && options.projectMaterialIds.length > 0) {
    const selectedMaterials = await Promise.all(
      options.projectMaterialIds.map((id) =>
        sqlQueryMaterial(userId, id)
      )
    );
    materials = selectedMaterials
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({ projectName: item!.projectName ?? "未命名项目", text: item!.rawText }));
  } else if (projectId) {
    // 兼容旧流程：未选择素材时回退到项目下的最新材料
    const project = await getWorkspaceProjectById(projectId, userId);
    const material = project ? await getLatestProjectMaterial(projectId, userId) : null;
    if (project && material?.rawText.trim()) {
      materials = [{ projectName: project.name, text: material.rawText }];
    }
  }

  // 问答来源：优先选中素材下的问答（方案 A），否则项目维度（兼容旧流程）
  const questionAnswers = options.projectMaterialIds?.length
    ? (
        await Promise.all(
          options.projectMaterialIds.map(async (id) => {
            const timeline = await listQuestionAnswerTimeline({ projectMaterialId: id }, userId);
            return timeline.map((item) => ({
              questionText: item.questionText,
              answerText: item.answerText
            }));
          })
        )
      ).flat()
    : projectId
      ? (await listQuestionAnswerTimeline({ projectId }, userId)).map((item) => ({
          questionText: item.questionText,
          answerText: item.answerText
        }))
      : [];

  if (materials.length === 0) {
    return {
      success: false,
      message: "请先到项目经历页保存项目原始材料，或选择要组合的项目经历，再生成项目卡片草稿。"
    };
  }

  try {
    const draft = await generateProjectCardDraft({
      projectName: materials.map((item) => item.projectName).join(" + ") || "项目卡片",
      targetRole: "",
      currentNeed: "从项目经历素材中提炼结构化项目卡片，用于后续岗位匹配与简历改写。",
      materials,
      questionAnswers,
      confirmedFields: options.confirmedFields
    });

    const card = await saveGeneratedProjectCard(
      userId,
      draft,
      {
        projectId,
        resumeMaterialId,
        projectMaterialIds: options.projectMaterialIds
      }
    );

    revalidatePath("/project-card");
    revalidatePath("/cards");

    return {
      success: true,
      message: options.confirmedFields
        ? "已基于确认内容重新生成项目卡片草稿并保存，可以继续确认和修改关键事实。"
        : "项目卡片草稿已生成并保存，可以继续确认和修改关键事实。",
      savedAt: card.updatedAt.toISOString(),
      model: draft.model,
      data: { cardId: card.id }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成项目卡片草稿失败，请稍后再试。"
    };
  }
}

/** 按 id 查询用户的一条项目材料（供组合选择用）。 */
async function sqlQueryMaterial(userId: string, materialId: string) {
  const { neon } = await import("@neondatabase/serverless");
  const connectionString = (process.env.DATABASE_URL ?? "").replace(/([?&])channel_binding=require(&?)/g, (_m: string, prefix: string, suffix: string) => {
    if (prefix === "?" && suffix) {
      return "?";
    }
    if (!suffix) {
      return "";
    }
    return prefix;
  }).replace(/[?&]$/, "");
  const sql = neon(connectionString);
  const rows = (await sql.query(
    `SELECT "id", "projectName", "rawText" FROM "ProjectMaterial" WHERE "id" = $1 AND "clerkUserId" = $2 LIMIT 1`,
    [materialId, userId]
  )) as Array<{ id: string; projectName: string | null; rawText: string }>;
  return rows[0] ? { projectName: rows[0].projectName, rawText: rows[0].rawText } : null;
}

export async function updateProjectCardAction(values: z.infer<typeof updateProjectCardSchema>): Promise<ActionResult> {
  const parsed = updateProjectCardSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "项目卡片保存失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();
  const card = await updateProjectCard(parsed.data.cardId, userId, parsed.data);

  if (!card) {
    return {
      success: false,
      message: "当前项目卡片不存在，或你无权编辑该草稿。"
    };
  }

  revalidatePath("/project-card");

  return {
    success: true,
    message: "项目卡片已更新，当前确认状态和修改内容已保存。",
    savedAt: card.updatedAt.toISOString()
  };
}

export async function saveProjectCardVersionAction(projectId: string | null, cardId?: string): Promise<ActionResult> {
  const userId = requireClerkUserId();

  // 优先按 cardId 保存（独立卡片库场景），否则回退项目最新卡片（兼容旧流程）
  const card = cardId
    ? await getProjectCardById(cardId, userId)
    : projectId
      ? await getLatestProjectCard(projectId, userId)
      : null;

  if (!card) {
    return {
      success: false,
      message: "当前还没有可保存的项目卡片，请先生成草稿。"
    };
  }

  const version = await createProjectCardVersion(card.id, userId, card);

  revalidatePath("/project-card");
  revalidatePath("/cards");

  return {
    success: true,
    message: `项目卡片版本已保存：${version.title}`,
    savedAt: version.createdAt.toISOString()
  };
}

/** 按 id 查询用户的一张项目卡片。 */
async function getProjectCardById(cardId: string, userId: string) {
  const { listProjectCards } = await import("@/lib/stage7-data");
  const cards = await listProjectCards(userId);
  return cards.find((card) => card.id === cardId) ?? null;
}
