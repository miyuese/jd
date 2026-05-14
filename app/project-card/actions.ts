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
  projectId: z.string().trim().min(1, "缺少项目信息，请重新选择项目。"),
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
    }
  | {
      success: false;
      message: string;
    };

export async function generateProjectCardDraftAction(projectId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const project = await getWorkspaceProjectById(projectId, userId);

  if (!project) {
    return {
      success: false,
      message: "当前项目不存在，或你无权为该项目生成项目卡片。"
    };
  }

  const material = await getLatestProjectMaterial(projectId, userId);
  const timeline = await listQuestionAnswerTimeline(projectId, userId);

  if (!material?.rawText.trim()) {
    return {
      success: false,
      message: "请先到项目材料页保存项目原始材料，再生成项目卡片草稿。"
    };
  }

  try {
    const draft = await generateProjectCardDraft({
      projectName: project.name,
      targetRole: project.targetRole,
      currentNeed: project.currentNeed,
      materialText: material.rawText,
      questionAnswers: timeline.map((item) => ({
        questionText: item.questionText,
        answerText: item.answerText
      }))
    });

    const card = await saveGeneratedProjectCard(projectId, userId, draft);

    revalidatePath("/project-card");

    return {
      success: true,
      message: "项目卡片草稿已生成并保存，可以继续确认和修改关键事实。",
      savedAt: card.updatedAt.toISOString(),
      model: draft.model
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成项目卡片草稿失败，请稍后再试。"
    };
  }
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
  const project = await getWorkspaceProjectById(parsed.data.projectId, userId);

  if (!project) {
    return {
      success: false,
      message: "当前项目不存在，或你无权保存该项目卡片。"
    };
  }

  const card = await updateProjectCard(parsed.data.cardId, parsed.data.projectId, userId, parsed.data);

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

export async function saveProjectCardVersionAction(projectId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const card = await getLatestProjectCard(projectId, userId);

  if (!card) {
    return {
      success: false,
      message: "当前还没有可保存的项目卡片，请先生成草稿。"
    };
  }

  const version = await createProjectCardVersion(projectId, userId, card);

  revalidatePath("/project-card");

  return {
    success: true,
    message: `项目卡片版本已保存：${version.title}`,
    savedAt: version.createdAt.toISOString()
  };
}
