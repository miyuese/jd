"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import { generateInterviewQuestions } from "@/lib/ai-config";
import { getWorkspaceProjectById } from "@/lib/neon-db";
import {
  createQuestionAnswerRecord,
  getLatestProjectMaterial,
  saveProjectMaterial
} from "@/lib/stage6-data";
import { autoIngestAndExtract } from "@/lib/memory-auto";

const projectMaterialSchema = z.object({
  projectId: z.string().trim().min(1, "缺少项目信息，请重新选择项目。"),
  content: z.string().trim().min(1, "请先输入项目原始材料，再点击保存。")
});

const questionAnswerSchema = z.object({
  projectId: z.string().trim().min(1, "缺少项目信息，请重新选择项目。"),
  questionText: z.string().trim().min(1, "缺少问题内容，请重新生成后再试。"),
  answerText: z.string().trim().min(1, "请先填写回答内容，再点击提交。")
});

type ActionResult =
  | {
      success: true;
      message: string;
      savedAt?: string;
      questions?: string[];
      model?: string;
    }
  | {
      success: false;
      message: string;
    };

export async function saveProjectMaterialAction(projectId: string, content: string): Promise<ActionResult> {
  const parsed = projectMaterialSchema.safeParse({ projectId, content });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "项目材料校验失败，请检查后再试。"
    };
  }

  const userId = requireClerkUserId();
  const project = await getWorkspaceProjectById(parsed.data.projectId, userId);

  if (!project) {
    return {
      success: false,
      message: "当前项目不存在，或你无权编辑该项目材料。"
    };
  }

  const record = await saveProjectMaterial(parsed.data.projectId, userId, parsed.data.content);

  // 自动沉淀到记忆库并提取能力标签（幂等去重，失败静默，不阻塞保存）
  await autoIngestAndExtract(userId, {
    sourceType: "PROJECT_MATERIAL",
    title: `项目材料 · ${project.name}`,
    rawText: parsed.data.content,
    projectId: parsed.data.projectId,
    sourceRefId: record.id
  });

  revalidatePath("/project-materials");
  revalidatePath("/memory");

  return {
    success: true,
    message: `项目「${project.name}」的原始材料已保存到数据库。`,
    savedAt: record.updatedAt.toISOString()
  };
}

export async function generateInterviewQuestionsAction(projectId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const project = await getWorkspaceProjectById(projectId, userId);

  if (!project) {
    return {
      success: false,
      message: "当前项目不存在，或你无权为该项目发起复盘。"
    };
  }

  const material = await getLatestProjectMaterial(projectId, userId);

  if (!material?.rawText.trim()) {
    return {
      success: false,
      message: "请先保存项目原始材料，再开始生成首轮采访问题。"
    };
  }

  try {
    const result = await generateInterviewQuestions({
      projectName: project.name,
      targetRole: project.targetRole,
      currentNeed: project.currentNeed,
      materialText: material.rawText
    });

    return {
      success: true,
      message: "首轮采访问题已生成，可以逐条回答并沉淀到下方时间线。",
      questions: result.questions,
      model: result.model
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成采访问题失败，请稍后再试。"
    };
  }
}

export async function saveQuestionAnswerAction(
  projectId: string,
  questionText: string,
  answerText: string
): Promise<ActionResult> {
  const parsed = questionAnswerSchema.safeParse({
    projectId,
    questionText,
    answerText
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "问答保存失败，请检查后再试。"
    };
  }

  const userId = requireClerkUserId();
  const project = await getWorkspaceProjectById(parsed.data.projectId, userId);

  if (!project) {
    return {
      success: false,
      message: "当前项目不存在，或你无权保存该项目的问答记录。"
    };
  }

  const qaRecord = await createQuestionAnswerRecord(
    parsed.data.projectId,
    userId,
    parsed.data.questionText,
    parsed.data.answerText
  );

  // 自动沉淀到记忆库并提取能力标签（幂等去重，失败静默，不阻塞问答保存）
  await autoIngestAndExtract(userId, {
    sourceType: "INTERVIEW_ANSWER",
    title: `采访问答 · ${project.name}`,
    rawText: `问：${parsed.data.questionText}\n答：${parsed.data.answerText}`,
    projectId: parsed.data.projectId,
    sourceRefId: qaRecord.id
  });

  revalidatePath("/project-materials");
  revalidatePath("/memory");

  return {
    success: true,
    message: "这一轮问答已保存，刷新后仍可在下方时间线查看。"
  };
}
