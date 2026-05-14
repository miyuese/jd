"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import { generateJdCapabilitySummary, generateMatchAnalysisDraft, generatePlainMatchAnalysisExplanations } from "@/lib/ai-config";
import { getWorkspaceProjectById } from "@/lib/neon-db";
import { getLatestProjectCard } from "@/lib/stage7-data";
import {
  createMatchAnalysisVersion,
  getLatestJdRecord,
  getLatestMatchAnalysis,
  saveGeneratedMatchAnalysis,
  saveJdRecord,
  updateJdCapabilitySummary,
  updateMatchAnalysis
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
    savedAt: jdRecord.updatedAt.toISOString()
  };
}

export async function generateCapabilitySummaryAction(projectId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const jdRecord = await getLatestJdRecord(projectId, userId);

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
      model: summary.model
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成岗位能力摘要失败，请稍后再试。"
    };
  }
}

export async function generateMatchAnalysisAction(projectId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const [jdRecord, projectCard] = await Promise.all([
    getLatestJdRecord(projectId, userId),
    getLatestProjectCard(projectId, userId)
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

  try {
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

    const plainExplanations = await generatePlainMatchAnalysisExplanations({
      matchedPoints: analysis.matchedPoints,
      gapPoints: analysis.gapPoints,
      suggestionPoints: analysis.suggestionPoints,
      summary: analysis.summary
    });

    const saved = await saveGeneratedMatchAnalysis(projectId, jdRecord.id, userId, {
      ...analysis,
      plainExplanations
    });

    revalidatePath("/jd-analysis");

    return {
      success: true,
      message: "匹配分析草稿已生成，可以继续确认表达重点。",
      savedAt: saved.updatedAt.toISOString(),
      model: analysis.model
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成匹配分析草稿失败，请稍后再试。"
    };
  }
}

export async function updateMatchAnalysisAction(values: z.infer<typeof updateMatchAnalysisSchema>): Promise<ActionResult> {
  const parsed = updateMatchAnalysisSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "匹配分析保存失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();
  const project = await getWorkspaceProjectById(parsed.data.projectId, userId);

  if (!project) {
    return {
      success: false,
      message: "当前项目不存在，或你无权保存该匹配分析。"
    };
  }

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

  revalidatePath("/jd-analysis");

  return {
    success: true,
    message: "匹配分析已更新，当前确认结果已保存。",
    savedAt: updated.updatedAt.toISOString()
  };
}

export async function saveMatchAnalysisVersionAction(projectId: string): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const analysis = await getLatestMatchAnalysis(projectId, userId);

  if (!analysis) {
    return {
      success: false,
      message: "当前还没有可保存的匹配分析草稿，请先生成分析。"
    };
  }

  const version = await createMatchAnalysisVersion(projectId, userId, analysis);

  revalidatePath("/jd-analysis");

  return {
    success: true,
    message: `匹配分析版本已保存：${version.title}`,
    savedAt: version.createdAt.toISOString()
  };
}
