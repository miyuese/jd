"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import { generateInterviewQuestions } from "@/lib/ai-config";
import {
  deleteProjectMaterial,
  getProjectMaterialById,
  saveProjectMaterial,
  updateProjectMaterial
} from "@/lib/stage6-data";
import {
  createQuestionAnswerRecord,
  listQuestionAnswerTimeline
} from "@/lib/stage6-data";
import { autoIngestAndExtract } from "@/lib/memory-auto";

const projectMaterialSchema = z.object({
  projectName: z.string().trim().min(1, "请填写项目经历名称（例如：AI 求职助手）。"),
  content: z.string().trim().min(1, "请先输入项目原始材料，再点击保存。")
});

const questionAnswerSchema = z.object({
  projectMaterialId: z.string().trim().min(1, "缺少项目经历信息，请重新选择。"),
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

/** 保存一份项目经历素材（用户级，独立于求职计划；多份并存）。 */
export async function saveProjectMaterialAction(projectName: string, content: string): Promise<ActionResult> {
  const parsed = projectMaterialSchema.safeParse({ projectName, content });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "项目材料校验失败，请检查后再试。"
    };
  }

  const userId = requireClerkUserId();

  const record = await saveProjectMaterial(userId, parsed.data.content, {
    projectId: null,
    projectName: parsed.data.projectName,
    title: parsed.data.projectName
  });

  // 自动沉淀到记忆库并提取能力标签（幂等去重，失败静默，不阻塞保存）
  await autoIngestAndExtract(userId, {
    sourceType: "PROJECT_MATERIAL",
    title: `项目经历 · ${parsed.data.projectName}`,
    rawText: parsed.data.content,
    projectId: null,
    sourceRefId: record.id
  });

  revalidatePath("/project-materials");
  revalidatePath("/memory");

  return {
    success: true,
    message: `项目经历「${parsed.data.projectName}」的原始材料已保存。`,
    savedAt: record.updatedAt.toISOString()
  };
}

/** 原地更新一份项目经历素材（修正内容用，不新增版本）。 */
export async function updateProjectMaterialAction(
  projectMaterialId: string,
  projectName: string,
  content: string
): Promise<ActionResult> {
  const parsed = projectMaterialSchema.safeParse({ projectName, content });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "项目材料校验失败，请检查后再试。"
    };
  }

  const userId = requireClerkUserId();
  const material = await getProjectMaterialById(projectMaterialId, userId);

  if (!material) {
    return {
      success: false,
      message: "当前项目经历不存在，或你无权编辑。"
    };
  }

  const updated = await updateProjectMaterial(projectMaterialId, userId, {
    projectName: parsed.data.projectName,
    rawText: parsed.data.content
  });

  // 自动沉淀到记忆库并提取能力标签（幂等去重，失败静默，不阻塞保存）
  await autoIngestAndExtract(userId, {
    sourceType: "PROJECT_MATERIAL",
    title: `项目经历 · ${parsed.data.projectName}`,
    rawText: parsed.data.content,
    projectId: material.projectId,
    sourceRefId: projectMaterialId
  });

  revalidatePath("/project-materials");
  revalidatePath("/memory");

  return {
    success: true,
    message: `项目经历「${parsed.data.projectName}」已更新。`,
    savedAt: updated?.updatedAt.toISOString()
  };
}

/** 删除一份项目经历素材（级联删除其问答与卡片关联）。 */
export async function deleteProjectMaterialAction(projectMaterialId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const material = await getProjectMaterialById(projectMaterialId, userId);

  if (!material) {
    return {
      success: false,
      message: "当前项目经历不存在，或你无权删除。"
    };
  }

  await deleteProjectMaterial(projectMaterialId, userId);

  revalidatePath("/project-materials");
  revalidatePath("/memory");

  return {
    success: true,
    message: `项目经历「${material.projectName ?? "未命名"}」已删除。`
  };
}

/** 基于某份项目经历生成首轮采访问题（问答挂在素材下，方案 A）。 */
export async function generateInterviewQuestionsAction(projectMaterialId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const material = await getProjectMaterialById(projectMaterialId, userId);

  if (!material?.rawText.trim()) {
    return {
      success: false,
      message: "请先保存项目原始材料，再开始生成首轮采访问题。"
    };
  }

  try {
    const result = await generateInterviewQuestions({
      projectName: material.projectName ?? "未命名项目",
      targetRole: "",
      currentNeed: "通过采访问答复盘这段项目经历，梳理背景、职责、关键动作与结果。",
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

/** 保存一条问答，挂到对应的项目经历素材下。 */
export async function saveQuestionAnswerAction(
  projectMaterialId: string,
  questionText: string,
  answerText: string
): Promise<ActionResult> {
  const parsed = questionAnswerSchema.safeParse({
    projectMaterialId,
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
  const material = await getProjectMaterialById(parsed.data.projectMaterialId, userId);

  if (!material) {
    return {
      success: false,
      message: "当前项目经历不存在，或你无权保存问答记录。"
    };
  }

  const qaRecord = await createQuestionAnswerRecord(
    { projectMaterialId: parsed.data.projectMaterialId },
    userId,
    parsed.data.questionText,
    parsed.data.answerText
  );

  // 自动沉淀到记忆库并提取能力标签（幂等去重，失败静默，不阻塞问答保存）
  await autoIngestAndExtract(userId, {
    sourceType: "INTERVIEW_ANSWER",
    title: `采访问答 · ${material.projectName ?? "未命名项目"}`,
    rawText: `问：${parsed.data.questionText}\n答：${parsed.data.answerText}`,
    projectId: material.projectId,
    sourceRefId: qaRecord.id
  });

  revalidatePath("/project-materials");
  revalidatePath("/memory");

  return {
    success: true,
    message: "这一轮问答已保存，刷新后仍可在下方时间线查看。"
  };
}

/** 读取某份项目经历的问答时间线。 */
export async function listProjectMaterialQuestionsAction(projectMaterialId: string): Promise<ActionResult & { timeline?: Array<{ id: string; roundIndex: number; questionText: string; answerText: string; createdAt: string }> }> {
  const userId = requireClerkUserId();
  const material = await getProjectMaterialById(projectMaterialId, userId);

  if (!material) {
    return {
      success: false,
      message: "当前项目经历不存在，或你无权查看。"
    };
  }

  const timeline = await listQuestionAnswerTimeline({ projectMaterialId }, userId);

  return {
    success: true,
    message: "问答时间线已读取。",
    timeline: timeline.map((item) => ({
      id: item.id,
      roundIndex: item.roundIndex,
      questionText: item.questionText,
      answerText: item.answerText,
      createdAt: item.createdAt.toISOString()
    }))
  };
}
