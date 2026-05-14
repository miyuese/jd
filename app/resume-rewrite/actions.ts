"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClerkUserId } from "@/lib/auth-scope";
import { generateResumeFragmentRewrite, generateResumeRewriteDraft } from "@/lib/ai-config";
import { getWorkspaceProjectById } from "@/lib/neon-db";
import { saveResumeRewriteContext } from "@/lib/stage9-data";
import { getLatestProjectCard } from "@/lib/stage7-data";
import { getLatestMatchAnalysis } from "@/lib/stage8-data";
import { createInterviewOutputVersion } from "@/lib/stage10-data";

const saveResumeContextSchema = z.object({
  content: z.string().trim().min(1, "请先确认简历上下文内容，再点击保存。")
});

const fragmentRewriteSchema = z.object({
  projectId: z.string().trim().min(1, "缺少项目信息，请重新选择项目。"),
  fullResumeText: z.string().trim().min(1, "当前缺少简历上下文，无法进行片段重写。"),
  selectedText: z.string().trim().min(1, "请先输入要重写的原文片段。"),
  rewriteMode: z.enum(["balanced", "result-focused", "responsibility-focused", "jd-focused"])
});

type ActionResult =
  | {
      success: true;
      message: string;
      savedAt?: string;
      rewrite?: string;
      reasoning?: string;
      highlights?: string[];
      model?: string;
    }
  | {
      success: false;
      message: string;
    };

export async function generateResumeRewriteAction(
  projectId: string,
  resumeText: string,
  rewriteMode: "balanced" | "result-focused" | "responsibility-focused" | "jd-focused"
): Promise<ActionResult> {
  const userId = requireClerkUserId();
  const [project, projectCard, matchAnalysis] = await Promise.all([
    getWorkspaceProjectById(projectId, userId),
    getLatestProjectCard(projectId, userId),
    getLatestMatchAnalysis(projectId, userId)
  ]);

  if (!project) {
    return {
      success: false,
      message: "当前项目不存在，或你无权为该项目生成简历改写。"
    };
  }

  if (!resumeText.trim()) {
    return {
      success: false,
      message: "请先在简历材料页保存已有简历内容，再回来生成改写草稿。"
    };
  }

  if (!projectCard) {
    return {
      success: false,
      message: "请先完成项目卡片确认，再开始简历改写。"
    };
  }

  if (!matchAnalysis) {
    return {
      success: false,
      message: "请先完成 JD 匹配分析，再开始简历改写。"
    };
  }

  try {
    const result = await generateResumeRewriteDraft({
      resumeText,
      rewriteMode,
      projectCard: {
        title: projectCard.title ?? project.name,
        background: projectCard.background ?? "",
        responsibility: projectCard.responsibility ?? "",
        result: projectCard.result ?? ""
      },
      matchAnalysis: {
        matchedPoints: matchAnalysis.matchedPoints as string[],
        gapPoints: matchAnalysis.gapPoints as string[],
        suggestionPoints: matchAnalysis.suggestionPoints as string[],
        summary: matchAnalysis.summary ?? "",
        plainExplanations: matchAnalysis.plainExplanations as {
          matchedPoints: string;
          gapPoints: string;
          suggestionPoints: string;
        }
      }
    });

    const rewriteModeLabels: Record<string, string> = {
      "balanced": "平衡版",
      "result-focused": "结果优先",
      "responsibility-focused": "职责优先",
      "jd-focused": "岗位贴合"
    };

    const version = await createInterviewOutputVersion(
      projectId,
      userId,
      `简历改写 · ${rewriteModeLabels[rewriteMode] ?? rewriteMode} · ${project.name}`,
      { type: "RESUME_REWRITE", rewriteMode, ...result },
      projectCard.id,
      matchAnalysis.id
    );

    revalidatePath("/resume-rewrite");
    revalidatePath("/history");

    return {
      success: true,
      message: "简历改写草稿已生成并保存为输出版本，可以对照原文判断是否应用到当前简历上下文。",
      rewrite: result.rewrite,
      reasoning: result.reasoning,
      highlights: result.highlights,
      model: result.model,
      savedAt: version.createdAt.toISOString()
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成简历改写草稿失败，请稍后再试。"
    };
  }
}

export async function saveResumeRewriteContextAction(content: string): Promise<ActionResult> {
  const parsed = saveResumeContextSchema.safeParse({ content });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "简历上下文保存失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();
  const record = await saveResumeRewriteContext(userId, parsed.data.content);

  revalidatePath("/resume-materials");
  revalidatePath("/resume-rewrite");

  return {
    success: true,
    message: "新的简历上下文已保存，后续生成会继续以这份最新内容为基础。",
    savedAt: record.updatedAt.toISOString()
  };
}

export async function generateResumeFragmentRewriteAction(
  projectId: string,
  fullResumeText: string,
  selectedText: string,
  rewriteMode: "balanced" | "result-focused" | "responsibility-focused" | "jd-focused"
): Promise<ActionResult> {
  const parsed = fragmentRewriteSchema.safeParse({
    projectId,
    fullResumeText,
    selectedText,
    rewriteMode
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "片段重写失败，请检查输入后再试。"
    };
  }

  const userId = requireClerkUserId();
  const [project, projectCard, matchAnalysis] = await Promise.all([
    getWorkspaceProjectById(projectId, userId),
    getLatestProjectCard(projectId, userId),
    getLatestMatchAnalysis(projectId, userId)
  ]);

  if (!project || !projectCard || !matchAnalysis) {
    return {
      success: false,
      message: "当前项目缺少项目卡片或匹配分析，暂时无法进行片段重写。"
    };
  }

  try {
    const result = await generateResumeFragmentRewrite({
      selectedText: parsed.data.selectedText,
      fullResumeText: parsed.data.fullResumeText,
      rewriteMode: parsed.data.rewriteMode,
      projectCard: {
        title: projectCard.title ?? project.name,
        background: projectCard.background ?? "",
        responsibility: projectCard.responsibility ?? "",
        result: projectCard.result ?? ""
      },
      matchAnalysis: {
        matchedPoints: matchAnalysis.matchedPoints as string[],
        gapPoints: matchAnalysis.gapPoints as string[],
        suggestionPoints: matchAnalysis.suggestionPoints as string[],
        summary: matchAnalysis.summary ?? ""
      }
    });

    return {
      success: true,
      message: "片段改写已生成，可以决定是否替换回当前简历上下文。",
      rewrite: result.rewrite,
      reasoning: result.reasoning,
      model: result.model
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "生成片段改写失败，请稍后再试。"
    };
  }
}
