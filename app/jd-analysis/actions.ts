"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import { generateJdCapabilitySummary, generateMatchAnalysisDraft, generatePlainMatchAnalysisExplanations } from "@/lib/ai-config";
import { getWorkspaceProjectById } from "@/lib/neon-db";
import { getLatestProjectCard } from "@/lib/stage7-data";
import { getVersionById } from "@/lib/stage11-data";
import {
  createMatchAnalysisVersion,
  getJdRecordById,
  getLatestJdRecord,
  getLatestMatchAnalysis,
  getMatchAnalysisByJdRecord,
  saveGeneratedMatchAnalysis,
  saveJdRecord,
  updateJdCapabilitySummary,
  updateMatchAnalysis,
  updateMatchAnalysisProjectCard
} from "@/lib/stage8-data";

const saveJdSchema = z.object({
  projectId: z.string().trim().min(1, "缺少项目信息，请重新选择项目。"),
  rawText: z.string().trim().min(1, "请先粘贴目标 JD 原文，再点击保存。")
});

const updateMatchAnalysisSchema = z.object({
  projectId: z.string().trim().min(1, "缺少项目信息，请重新选择项目。"),
  matchAnalysisId: z.string().trim().min(1, "当前还没有可编辑的匹配分析草稿。"),
  matchedPoints: z.array(z.string().trim().min(1)).min(1, "请至少保留一条匹配点。"),
  gapPoints: z.array(z.string().trim().min(1)).min(1, "请至少保留一条差距点。"),
  suggestionPoints: z.array(z.string().trim().min(1)).min(1, "请至少保留一条补充建议。"),
  plainMatchedPoints: z.string().trim().min(1, "请填写匹配点的通俗解释。"),
  plainGapPoints: z.string().trim().min(1, "请填写差距点的通俗解释。"),
  plainSuggestionPoints: z.string().trim().min(1, "请填写补充建议的通俗解释。"),
  summary: z.string().trim().min(1, "请填写匹配分析总结。"),
  status: z.enum(["DRAFT", "PENDING_CONFIRMATION", "CONFIRMED"])
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

export async function saveJdRecordAction(projectId: string, rawText: string): Promise<ActionResult> {
  const parsed = saveJdSchema.safeParse({ projectId, rawText });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "JD 保存失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();
  const project = await getWorkspaceProjectById(parsed.data.projectId, userId);

  if (!project) {
    return {
      success: false,
      message: "当前项目不存在，或你无权为该项目保存 JD。"
    };
  }

  const jdRecord = await saveJdRecord(parsed.data.projectId, userId, parsed.data.rawText);

  revalidatePath("/jd-analysis");

  return {
    success: true,
    message: "目标 JD 已保存，可以继续生成岗位能力摘要。",
    savedAt: jdRecord.updatedAt.toISOString(),
    data: { jdId: jdRecord.id }
  };
}

export async function generateCapabilitySummaryAction(projectId: string, jdId?: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const jdRecord = jdId ? await getJdRecordById(jdId, userId) : await getLatestJdRecord(projectId, userId);

  if (!jdRecord?.rawText.trim()) {
    return {
      success: false,
      message: "请先保存目标 JD 原文，再生成岗位能力摘要。"
    };
  }

  try {
    const summary = await generateJdCapabilitySummary({ rawText: jdRecord.rawText });
    const updated = await updateJdCapabilitySummary(jdRecord.id, {
      responsibilities: summary.responsibilities,
      capabilities: summary.capabilities,
      priorities: summary.priorities
    });

    revalidatePath("/jd-analysis");

    return {
      success: true,
      message: "岗位能力摘要已生成并保存，可以继续开始匹配分析。",
      savedAt: updated?.updatedAt.toISOString(),
      model: summary.model,
      data: { jdId: jdRecord.id }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成岗位能力摘要失败，请稍后再试。"
    };
  }
}

export async function generateMatchAnalysisAction(projectId: string, jdId?: string, projectCardId?: string): Promise<ActionResult> {
  let stage = "初始化";

  try {
    stage = "读取登录用户";
    const userId = requireClerkUserId();

    stage = "读取 JD 记录和项目卡片";
    const [jdRecord, projectCard] = await Promise.all([
      jdId ? getJdRecordById(jdId, userId) : getLatestJdRecord(projectId, userId),
      projectCardId ? getProjectCardById(projectCardId, userId) : getLatestProjectCard(projectId, userId)
    ]);

    if (!projectCard) {
      return {
        success: false,
        message: "请先到项目卡片页生成并确认项目卡片，再开始匹配分析。"
      };
    }

    const capabilitySummary = jdRecord?.capabilitySummary as
      | {
          responsibilities?: string[];
          capabilities?: string[];
          priorities?: Array<{ label: string; level: string }>;
        }
      | null;

    if (!jdRecord || !capabilitySummary?.responsibilities?.length || !capabilitySummary.capabilities?.length || !capabilitySummary.priorities?.length) {
      return {
        success: false,
        message: "请先生成岗位能力摘要，再开始匹配分析。"
      };
    }

    stage = "调用 API 生成匹配分析";
    const analysis = await generateMatchAnalysisDraft({
      projectCard: {
        title: projectCard.title ?? "项目卡片草稿",
        background: projectCard.background ?? "",
        responsibility: projectCard.responsibility ?? "",
        result: projectCard.result ?? ""
      },
      capabilitySummary: {
        responsibilities: capabilitySummary.responsibilities,
        capabilities: capabilitySummary.capabilities,
        priorities: capabilitySummary.priorities
      }
    });

    stage = "生成通俗解释";
    const plainExplanations = await generatePlainMatchAnalysisExplanations({
      matchedPoints: analysis.matchedPoints,
      gapPoints: analysis.gapPoints,
      suggestionPoints: analysis.suggestionPoints,
      summary: analysis.summary
    });

    stage = "保存匹配分析到数据库";
    const saved = await saveGeneratedMatchAnalysis(projectId, jdRecord.id, userId, {
      ...analysis,
      plainExplanations
    }, projectCard.id);

    // 自动写入版本快照（与简历改写/面试输出对齐）：AI 产出一份分析就留一份历史，
    // 保证历史版本页能看到，避免"生成过但历史页空"的困惑
    stage = "写入匹配分析版本快照";
    await createMatchAnalysisVersion(projectId, userId, saved);

    stage = "刷新 JD 分析页面缓存";
    revalidatePath("/jd-analysis");

    return {
      success: true,
      message: "匹配分析草稿已生成并保存版本，可以继续确认表达重点。",
      savedAt: saved.updatedAt.toISOString(),
      model: analysis.model,
      data: { matchAnalysisId: saved.id }
    };
  } catch (error) {
    console.error("generateMatchAnalysisAction failed:", {
      stage,
      projectId,
      error
    });

    const message = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message: `匹配分析失败（${stage}）：${message || "未知错误"}`
    };
  }
}

/** 按 id 查询用户的一张项目卡片（供交叉点选择用）。 */
async function getProjectCardById(projectCardId: string, userId: string) {
  const { listProjectCards } = await import("@/lib/stage7-data");
  const cards = await listProjectCards(userId);
  return cards.find((card) => card.id === projectCardId) ?? null;
}

export async function updateMatchAnalysisAction(values: z.infer<typeof updateMatchAnalysisSchema>): Promise<ActionResult> {
  const parsed = updateMatchAnalysisSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "匹配分析保存失败，请检查输入后再试。"
    };
  }

  let stage = "初始化";

  try {
    stage = "读取登录用户";
    const userId = requireClerkUserId();

    stage = "校验项目权限";
    const project = await getWorkspaceProjectById(parsed.data.projectId, userId);

    if (!project) {
      return {
        success: false,
        message: "当前项目不存在，或你无权保存该匹配分析。"
      };
    }

    stage = "保存匹配分析到数据库";
    const updated = await updateMatchAnalysis(parsed.data.matchAnalysisId, parsed.data.projectId, userId, {
      matchedPoints: parsed.data.matchedPoints,
      gapPoints: parsed.data.gapPoints,
      suggestionPoints: parsed.data.suggestionPoints,
      plainExplanations: {
        matchedPoints: parsed.data.plainMatchedPoints,
        gapPoints: parsed.data.plainGapPoints,
        suggestionPoints: parsed.data.plainSuggestionPoints
      },
      summary: parsed.data.summary,
      status: parsed.data.status
    });

    if (!updated) {
      return {
        success: false,
        message: "当前匹配分析不存在，或你无权编辑该草稿。"
      };
    }

    // 统一保存语义：保存草稿的同时写入版本快照（与左侧「保存匹配分析版本」行为一致，
    // 保证历史记录可回看，避免"保存成功但左侧版本列表无记录"的困惑）
    stage = "写入匹配分析版本快照";
    await createMatchAnalysisVersion(parsed.data.projectId, userId, updated);

    stage = "刷新 JD 分析页面缓存";
    revalidatePath("/jd-analysis");

    return {
      success: true,
      message: "匹配分析已更新并保存版本，可以在左侧版本列表查看历史快照。",
      savedAt: updated.updatedAt.toISOString()
    };
  } catch (error) {
    console.error("updateMatchAnalysisAction failed:", {
      stage,
      projectId: parsed.data.projectId,
      matchAnalysisId: parsed.data.matchAnalysisId,
      error
    });

    return {
      success: false,
      message: `保存匹配分析失败（${stage}）：${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function saveMatchAnalysisVersionAction(
  projectId: string,
  options: {
    jdId?: string;
    cardId?: string;
    content?: {
      matchAnalysisId: string;
      matchedPoints: string[];
      gapPoints: string[];
      suggestionPoints: string[];
      plainMatchedPoints: string;
      plainGapPoints: string;
      plainSuggestionPoints: string;
      summary: string;
      status: string;
    };
  } = {}
): Promise<ActionResult> {
  let stage = "初始化";

  try {
    stage = "读取登录用户";
    const userId = requireClerkUserId();
    const { jdId, cardId, content } = options;

    // 传入了前端当前编辑内容：先落草稿，再基于该内容生成版本快照，
    // 保证「保存版本」= 保存此刻你看到的内容，与右下角「保存当前匹配分析」行为一致。
    if (content) {
      stage = "校验匹配分析内容";
      const parsed = updateMatchAnalysisSchema.safeParse({
        projectId,
        matchAnalysisId: content.matchAnalysisId,
        matchedPoints: content.matchedPoints,
        gapPoints: content.gapPoints,
        suggestionPoints: content.suggestionPoints,
        plainMatchedPoints: content.plainMatchedPoints,
        plainGapPoints: content.plainGapPoints,
        plainSuggestionPoints: content.plainSuggestionPoints,
        summary: content.summary,
        status: content.status
      });

      if (!parsed.success) {
        return {
          success: false,
          message: parsed.error.issues[0]?.message ?? "保存版本失败，请检查匹配分析内容。"
        };
      }

      stage = "校验项目权限";
      const project = await getWorkspaceProjectById(projectId, userId);

      if (!project) {
        return {
          success: false,
          message: "当前项目不存在，或你无权保存该匹配分析版本。"
        };
      }

      stage = "保存匹配分析草稿";
      const updated = await updateMatchAnalysis(parsed.data.matchAnalysisId, projectId, userId, {
        matchedPoints: parsed.data.matchedPoints,
        gapPoints: parsed.data.gapPoints,
        suggestionPoints: parsed.data.suggestionPoints,
        plainExplanations: {
          matchedPoints: parsed.data.plainMatchedPoints,
          gapPoints: parsed.data.plainGapPoints,
          suggestionPoints: parsed.data.plainSuggestionPoints
        },
        summary: parsed.data.summary,
        status: parsed.data.status
      });

      if (!updated) {
        return {
          success: false,
          message: "当前匹配分析不存在，或你无权编辑该草稿。"
        };
      }

      // 兼容旧数据：分析无卡片关联但页面已选中卡片时回填维度
      let resolvedCardId = updated.projectCardId;
      if (cardId && !updated.projectCardId) {
        await updateMatchAnalysisProjectCard(updated.id, cardId, userId);
        resolvedCardId = cardId;
      }

      stage = "写入匹配分析版本快照";
      const version = await createMatchAnalysisVersion(projectId, userId, {
        ...updated,
        projectCardId: resolvedCardId
      });

      stage = "刷新 JD 分析页面缓存";
      revalidatePath("/jd-analysis");

      return {
        success: true,
        message: `匹配分析版本已保存：${version.title}`,
        savedAt: version.createdAt.toISOString()
      };
    }

    stage = "读取当前匹配分析（优先按交叉点卡片×JD）";
    const analysis = jdId
      ? await getMatchAnalysisByJdRecord(jdId, userId, cardId)
      : await getLatestMatchAnalysis(projectId, userId);

    if (!analysis) {
      return {
        success: false,
        message: "当前还没有可保存的匹配分析草稿，请先生成分析。"
      };
    }

    // 兼容旧数据：V2 前的分析没有卡片关联（projectCardId 为 null），
    // 若页面已选中卡片则回填维度，保证新保存的版本能正确归位到「卡片 × JD」交叉点。
    let resolvedCardId = analysis.projectCardId;
    if (cardId && !analysis.projectCardId) {
      await updateMatchAnalysisProjectCard(analysis.id, cardId, userId);
      resolvedCardId = cardId;
    }

    stage = "保存匹配分析版本到数据库";
    const version = await createMatchAnalysisVersion(projectId, userId, {
      ...analysis,
      projectCardId: resolvedCardId
    });

    stage = "刷新 JD 分析页面缓存";
    revalidatePath("/jd-analysis");

    return {
      success: true,
      message: `匹配分析版本已保存：${version.title}`,
      savedAt: version.createdAt.toISOString()
    };
  } catch (error) {
    console.error("saveMatchAnalysisVersionAction failed:", {
      stage,
      projectId,
      error
    });

    return {
      success: false,
      message: `保存匹配分析版本失败（${stage}）：${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/** 读取匹配分析版本详情（供左侧版本列表点击查看历史快照）。 */
export async function getMatchAnalysisVersionDetailAction(
  versionId: string
): Promise<{ success: true; title: string; createdAt: string; content: unknown } | { success: false; message: string }> {
  const userId = requireClerkUserId();
  const version = await getVersionById(versionId, userId);

  if (!version) {
    return { success: false, message: "未找到该版本记录，或你无权访问。" };
  }

  return {
    success: true,
    title: version.title,
    createdAt: version.createdAt.toISOString(),
    content: version.content
  };
}
